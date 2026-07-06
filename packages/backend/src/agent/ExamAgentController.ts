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
  type QuestionBank,
  type QuestionFormat,
} from '@aws-exam-generator/shared';
import { QuestionBankManager } from './QuestionBankManager.js';
import { QuestionGenerator } from './QuestionGenerator.js';

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

  constructor(
    private readonly questionGenerator: QuestionGenerator,
    private readonly questionBankManager: QuestionBankManager,
    private readonly certificationRegistry: CertificationRegistry,
    private readonly checkpointPath: string,
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
    try {
      const plan = resumeFrom?.plan ?? this.buildPlan(certification);
      const bank: QuestionBank = {
        bankId,
        certificationId: certification.id,
        certificationName: certification.displayName,
        examCode: certification.examCode,
        createdAt: resumeFrom?.createdAt ?? new Date().toISOString(),
        questions: resumeFrom ? [...resumeFrom.questions] : [],
      };
      const startIndex = bank.questions.length;

      for (let index = startIndex; index < plan.length; index += 1) {
        const item = plan[index]!;
        const question = await this.questionGenerator.generateQuestion(certification, item.domainId, item.format);
        bank.questions.push(question);
        this.status = {
          ...this.status,
          generatedQuestions: index + 1,
          updatedAt: new Date().toISOString(),
          message: `Generated ${index + 1}/${plan.length} questions for ${certification.id}.`,
        };
        // Checkpoint after every question so no generated question is lost if the
        // process is interrupted (crash, restart, network failure, etc.).
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
      };
    } catch (error) {
      this.status = {
        ...this.status,
        state: 'failed',
        updatedAt: new Date().toISOString(),
        lastError: error instanceof Error ? error.message : String(error),
        message: 'Generation failed.',
      };
    } finally {
      this.active = false;
    }
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
    return Array.from({ length: certification.totalQuestions }, (_, index) => ({
      domainId: shuffledDomains[index] ?? certification.domains[0]!.id,
      format: shuffledFormats[index] ?? (FORMAT_OPTION_COUNT['single-4'] ? 'single-4' : 'multi-5'),
    }));
  }
}
