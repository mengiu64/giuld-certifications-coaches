import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import {
  DEFAULT_CERTIFICATION_ID,
  FORMAT_OPTION_COUNT,
  generationStatusSchema,
  type CertificationConfig,
  type CertificationRegistry,
  type GenerationCheckpoint,
  type GenerationPlanItem,
  type GenerationStatus,
  type Question,
  type QuestionBank,
  type QuestionFormat,
} from '@aws-exam-generator/shared';
import { QuestionBankManager } from './QuestionBankManager.js';
import { QuestionGenerator } from './QuestionGenerator.js';
import { DomainUseCasePlanner, QualityKpiAggregator, QualityPipeline, countNoveltyRejects } from './QualityPipeline.js';

const shuffle = <T>(values: T[]): T[] => {
  const next = [...values];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex] as T, next[index] as T];
  }
  return next;
};

const distributeCounts = (weights: Array<{ key: string; weight: number }>, total: number): Map<string, number> => {
  const raw = weights.map((entry) => ({
    ...entry,
    exact: (entry.weight / 100) * total,
  }));
  const base = raw.map((entry) => ({ ...entry, count: Math.floor(entry.exact) }));
  let assigned = base.reduce((sum, entry) => sum + entry.count, 0);
  const orderedByRemainder = [...base].sort((left, right) => (right.exact - right.count) - (left.exact - left.count));
  let index = 0;
  while (assigned < total) {
    orderedByRemainder[index % orderedByRemainder.length]!.count += 1;
    assigned += 1;
    index += 1;
  }
  return new Map(orderedByRemainder.map((entry) => [entry.key, entry.count]));
};

export class ExamAgentController {
  private active = false;
  private status: GenerationStatus = {
    state: 'idle',
    generatedQuestions: 0,
    targetQuestions: 0,
    updatedAt: new Date().toISOString(),
    message: 'No generation job is active.',
  };
  private readonly useCasePlanner = new DomainUseCasePlanner();

  constructor(
    private readonly questionGenerator: QuestionGenerator,
    private readonly questionBankManager: QuestionBankManager,
    private readonly certificationRegistry: CertificationRegistry,
    private readonly checkpointPath: string,
    private readonly qualityPipeline: QualityPipeline,
  ) {}

  getStatus(): GenerationStatus {
    return generationStatusSchema.parse(this.status);
  }

  async startGeneration(certificationId?: string): Promise<GenerationStatus> {
    if (this.active) {
      const conflict = new Error('A generation job is already running.');
      conflict.name = 'ConflictError';
      throw conflict;
    }
    const certification = this.certificationRegistry.getById(certificationId ?? DEFAULT_CERTIFICATION_ID);
    if (!certification) {
      const notFound = new Error(`Unknown certification: ${certificationId ?? DEFAULT_CERTIFICATION_ID}`);
      notFound.name = 'ValidationError';
      throw notFound;
    }

    if (certification.topicDistribution) {
      console.info(
        `[ExamAgentController] Topic distribution loaded for ${certification.id}: ${JSON.stringify(certification.topicDistribution)}`,
      );
    }

    const checkpointPath = this.checkpointPathFor(certification.id);
    const existingCheckpoint = await this.questionBankManager.readCheckpoint(checkpointPath);
    const resuming = Boolean(
      existingCheckpoint &&
        existingCheckpoint.certificationId === certification.id &&
        existingCheckpoint.questionCount < existingCheckpoint.plan.length,
    );

    this.active = true;
    const bankId = resuming && existingCheckpoint ? existingCheckpoint.bankId : uuidv4();
    const generatedQuestions = resuming && existingCheckpoint ? existingCheckpoint.questionCount : 0;
    this.status = {
      state: 'running',
      certificationId: certification.id,
      bankId,
      generatedQuestions,
      targetQuestions: certification.totalQuestions,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      message: resuming
        ? `Resuming generation for ${certification.id} from checkpoint (${generatedQuestions}/${certification.totalQuestions} already generated).`
        : `Generating ${certification.totalQuestions} questions for ${certification.id}.`,
      checkpointPath,
      resumedFromCheckpoint: resuming,
    };
    void this.runGeneration(certification, bankId, checkpointPath, resuming ? existingCheckpoint : null);
    return this.getStatus();
  }

  private async runGeneration(
    certification: CertificationConfig,
    bankId: string,
    checkpointPath: string,
    resumeFrom: GenerationCheckpoint | null,
  ): Promise<void> {
    let bank: QuestionBank | null = null;
    try {
      const plan = resumeFrom?.plan ?? this.buildPlan(certification);
      const historyCorpus = await this.questionBankManager.getAllQuestionsForCertification(certification.id);
      bank = {
        bankId,
        certificationId: certification.id,
        certificationName: certification.displayName,
        examCode: certification.examCode,
        createdAt: resumeFrom?.createdAt ?? new Date().toISOString(),
        questions: resumeFrom ? [...resumeFrom.questions] : [],
      };
      const startIndex = bank.questions.length;
      let noveltyRejects = 0;
      let qualityAttempts = 0;

      for (let index = startIndex; index < plan.length; index += 1) {
        const item = plan[index]!;
        const approved = await this.generateWithQualityGates(certification, bankId, index, item, bank.questions, historyCorpus);
        qualityAttempts += approved.attempts;
        noveltyRejects += approved.noveltyRejects;
        bank.questions.push(approved.question);

        this.status = {
          ...this.status,
          generatedQuestions: index + 1,
          updatedAt: new Date().toISOString(),
          message: `Generated ${index + 1}/${plan.length} questions for ${certification.id}.`,
        };

        const checkpoint: GenerationCheckpoint = {
          certificationId: certification.id,
          bankId,
          createdAt: bank.createdAt,
          questionCount: bank.questions.length,
          questions: bank.questions,
          plan,
          updatedAt: new Date().toISOString(),
        };
        await this.questionBankManager.writeCheckpoint(checkpointPath, checkpoint);
      }

      const qualityKpis = QualityKpiAggregator.compute(bank.questions, noveltyRejects, qualityAttempts);
      bank.qualityKpis = qualityKpis;

      await this.questionBankManager.saveQuestionBank(bank);
      await this.questionBankManager.clearCheckpoint(checkpointPath);
      this.status = {
        state: 'completed',
        certificationId: certification.id,
        bankId,
        generatedQuestions: plan.length,
        targetQuestions: plan.length,
        startedAt: this.status.startedAt,
        updatedAt: new Date().toISOString(),
        message: `Question bank ${bankId} generated successfully.`,
        qualityKpis,
        reviewFlag: qualityKpis.reviewFlag,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      const qCount = bank?.questions.length ?? 0;
      console.error(`[ExamAgentController] Generation FAILED at question ${qCount}: ${errorMsg}`);
      console.error(`[ExamAgentController] Error stack:`, error instanceof Error ? error.stack : '(no stack)');
      this.status = {
        ...this.status,
        state: 'failed',
        updatedAt: new Date().toISOString(),
        lastError: errorMsg,
        message: 'Generation failed.',
      };
    } finally {
      this.active = false;
    }
  }

  private async generateWithQualityGates(
    certification: CertificationConfig,
    bankId: string,
    index: number,
    item: GenerationPlanItem,
    inProgressQuestions: Question[],
    historicalCorpus: Question[],
  ): Promise<{ question: Question; attempts: number; noveltyRejects: number }> {
    let attempts = 0;
    let noveltyRejects = 0;
    let lastError = 'Unknown quality pipeline rejection';

    while (attempts < this.qualityPipeline.maxRetries()) {
      attempts += 1;
      const generated = await this.questionGenerator.generateQuestion(
        certification,
        item.domainId,
        item.format,
        item.topic,
      );
      generated.useCaseFamily = item.useCaseFamily;

      const evaluated = this.qualityPipeline.evaluateCandidate(
        generated,
        inProgressQuestions,
        historicalCorpus,
        `${bankId}:${index}:${attempts}`,
      );
      noveltyRejects += countNoveltyRejects(evaluated.decisions);

      if (evaluated.accepted) {
        console.info(`[ExamAgentController] Quality gates passed after ${attempts} attempt(s)`);
        return {
          question: evaluated.question,
          attempts,
          noveltyRejects,
        };
      }

      const lastDecision = evaluated.decisions[evaluated.decisions.length - 1];
      lastError = `${lastDecision?.gateId ?? 'quality-gate'}:${lastDecision?.reasonCode ?? 'rejected'}`;
      console.warn(`[ExamAgentController] Quality gate rejected at attempt ${attempts}/${this.qualityPipeline.maxRetries()}: gate=${lastDecision?.gateId}, reason=${lastDecision?.reasonCode}`);
      console.debug(`[ExamAgentController] Rejected question domain=${item.domainId}, decisions count=${evaluated.decisions.length}`);
      for (const decision of evaluated.decisions) {
        console.debug(`  - ${decision.gateId}: ${decision.reasonCode} (result=${decision.result})`);
      }
    }

    throw new Error(
      `Question generation exceeded quality retry limit for domain=${item.domainId}, format=${item.format}, reason=${lastError}`,
    );
  }

  private checkpointPathFor(certificationId: string): string {
    const parsed = path.parse(this.checkpointPath);
    const safeCertId = certificationId.replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(parsed.dir, `${parsed.name}-${safeCertId}${parsed.ext}`);
  }

  private buildPlan(certification: CertificationConfig): GenerationPlanItem[] {
    const domainCounts = distributeCounts(
      certification.domains.map((domain) => ({ key: domain.id, weight: domain.percentage })),
      certification.totalQuestions,
    );
    const formatCounts = distributeCounts(
      [
        { key: 'single-4', weight: certification.formatDistribution.singleAnswer4Options },
        { key: 'multi-5', weight: certification.formatDistribution.multiAnswer5Options },
        { key: 'multi-6', weight: certification.formatDistribution.multiAnswer6Options },
      ],
      certification.totalQuestions,
    );
    const domainQueue = Array.from(domainCounts.entries()).flatMap(([domainId, count]) =>
      Array.from({ length: count }, () => domainId),
    );
    const formatQueue = Array.from(formatCounts.entries()).flatMap(([format, count]) =>
      Array.from({ length: count }, () => format as QuestionFormat),
    );
    const shuffledDomains = shuffle(domainQueue);
    const shuffledFormats = shuffle(formatQueue);
    const plan: GenerationPlanItem[] = Array.from({ length: certification.totalQuestions }, (_, index) => ({
      domainId: shuffledDomains[index] ?? certification.domains[0]!.id,
      format: shuffledFormats[index] ?? (FORMAT_OPTION_COUNT['single-4'] ? 'single-4' : 'multi-5'),
    }));

    this.assignTopicTags(plan, certification);
    this.useCasePlanner.assign(plan, certification);

    return plan;
  }

  private assignTopicTags(plan: GenerationPlanItem[], certification: CertificationConfig): void {
    if (!certification.topicDistribution || Object.keys(certification.topicDistribution).length === 0) {
      return;
    }

    const topicWeights = Object.entries(certification.topicDistribution).map(([topic, percentage]) => ({
      key: topic,
      weight: percentage,
    }));
    const topicCounts = distributeCounts(topicWeights, certification.totalQuestions);

    const domainWeights = certification.domains.map((domain) => ({
      key: domain.id,
      weight: domain.percentage,
    }));

    const domainTopicCounts = new Map<string, Map<string, number>>();
    for (const [topic, count] of topicCounts) {
      const perDomain = distributeCounts(domainWeights, count);
      domainTopicCounts.set(topic, perDomain);
    }

    console.info(
      `[ExamAgentController] Topic allocation for ${certification.id}: ${JSON.stringify(Object.fromEntries(topicCounts))}`,
    );
    const perDomainBreakdown: Record<string, Record<string, number>> = {};
    for (const [topic, perDomain] of domainTopicCounts) {
      perDomainBreakdown[topic] = Object.fromEntries(perDomain);
    }
    console.info(
      `[ExamAgentController] Per-domain topic breakdown for ${certification.id}: ${JSON.stringify(perDomainBreakdown)}`,
    );

    const domainItemIndices = new Map<string, number[]>();
    for (let i = 0; i < plan.length; i += 1) {
      const item = plan[i]!;
      const indices = domainItemIndices.get(item.domainId) ?? [];
      indices.push(i);
      domainItemIndices.set(item.domainId, indices);
    }

    for (const [domainId, indices] of domainItemIndices) {
      let offset = 0;
      for (const [topic, perDomain] of domainTopicCounts) {
        const countForDomain = perDomain.get(domainId) ?? 0;
        for (let j = 0; j < countForDomain && offset + j < indices.length; j += 1) {
          plan[indices[offset + j]!]!.topic = topic;
        }
        offset += countForDomain;
      }
    }
  }
}
