import type {
  CertificationConfig,
  DistractorAnalysisItem,
  ExplanationRubric,
  GenerationPlanItem,
  NoveltyScores,
  QualityGateDecision,
  QualityKpiReport,
  Question,
  ScenarioProfile,
  StyleSignature,
} from '@aws-exam-generator/shared';

const tokenize = (value: string): Set<string> =>
  new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((token) => token.length > 2),
  );

const jaccardSimilarity = (left: string, right: string): number => {
  const leftTokens = tokenize(left);
  const rightTokens = tokenize(right);
  if (leftTokens.size === 0 && rightTokens.size === 0) {
    return 1;
  }
  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;
  return union === 0 ? 0 : intersection / union;
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const hashSeed = (value: string): number => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
};

const pickDeterministic = <T>(values: readonly T[], seed: number): T => values[(seed >>> 0) % values.length]!;

const SCENARIO_POOLS = {
  industries: ['financial-services', 'retail', 'healthcare', 'telecom', 'public-sector'],
  sizes: ['startup', 'mid-market', 'enterprise'] as const,
  geographies: ['eu-multi-region-gdpr', 'us-multi-region-sox', 'global-pci-dss', 'apac-data-residency'],
  maturity: ['greenfield', 'brownfield', 'hybrid'] as const,
  objectives: [
    'reduce-operational-overhead',
    'improve-resilience-and-dr',
    'accelerate-migration',
    'improve-governance-and-security',
    'optimize-latency-and-cost',
  ],
};

const STYLE_PATTERNS = {
  openings: [
    'A global enterprise is',
    'A fast-growing company is',
    'An international organization is',
    'A regulated business is',
    'A multi-account platform team is',
  ],
  intents: ['least-operational-overhead', 'highest-resilience', 'best-cost-performance', 'first-priority-action'],
  shapes: ['single-decision', 'best-combination', 'ordered-steps', 'tradeoff-choice'],
};

const GENERIC_DISTRACTOR_MARKERS = ['all of the above', 'none of the above', 'always', 'never'];

const USE_CASE_FAMILIES_BY_DOMAIN: Record<string, string[]> = {
  'design-solutions-organizational-complexity': ['multi-account-governance', 'identity-delegation', 'network-segmentation'],
  'design-new-solutions': ['greenfield-architecture', 'data-platform', 'event-driven-integration'],
  'continuous-improvement-existing-solutions': ['cost-optimization', 'reliability-hardening', 'observability-improvements'],
  'accelerate-workload-migration-modernization': ['rehost-refactor', 'database-migration', 'application-decomposition'],
};

export interface QualityPipelineConfig {
  noveltyEnabled: boolean;
  stemSimilarityThreshold: number;
  explanationSimilarityThreshold: number;
  qualityRetryLimit: number;
  styleRepetitionWindow: number;
}

interface MultiPassReviewOutcome {
  passed: boolean;
  issues: string[];
}

interface GateResult {
  accepted: boolean;
  question: Question;
  decisions: QualityGateDecision[];
  noveltyScores: NoveltyScores;
}

export class ScenarioProfileBuilder {
  build(seedKey: string): ScenarioProfile {
    const seed = hashSeed(seedKey);
    return {
      industry: pickDeterministic(SCENARIO_POOLS.industries, seed),
      organizationSize: pickDeterministic(SCENARIO_POOLS.sizes, seed >> 2),
      geographyCompliance: pickDeterministic(SCENARIO_POOLS.geographies, seed >> 4),
      migrationMaturity: pickDeterministic(SCENARIO_POOLS.maturity, seed >> 6),
      businessObjective: pickDeterministic(SCENARIO_POOLS.objectives, seed >> 8),
    };
  }
}

export class DomainUseCasePlanner {
  assign(plan: GenerationPlanItem[], certification: CertificationConfig): void {
    const domains = certification.domains.map((domain) => domain.id);
    for (const domainId of domains) {
      const familyPool = USE_CASE_FAMILIES_BY_DOMAIN[domainId] ?? ['core-architecture'];
      const domainItems = plan
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => item.domainId === domainId);
      domainItems.forEach(({ index }, familyIndex) => {
        plan[index] = {
          ...plan[index]!,
          useCaseFamily: familyPool[familyIndex % familyPool.length],
        };
      });
    }
  }
}

export class StyleEntropyGuard {
  apply(
    stem: string,
    history: Question[],
    seedKey: string,
    repetitionWindow: number,
  ): { signature: StyleSignature; repeated: boolean } {
    void stem;
    const seed = hashSeed(seedKey);
    const signature: StyleSignature = {
      openingPattern: pickDeterministic(STYLE_PATTERNS.openings, seed),
      decisionIntent: pickDeterministic(STYLE_PATTERNS.intents, seed >> 3),
      rhetoricalShape: pickDeterministic(STYLE_PATTERNS.shapes, seed >> 5),
    };
    const recentOpenings = history
      .slice(-Math.max(1, repetitionWindow))
      .map((question) => question.styleSignature?.openingPattern)
      .filter((opening): opening is string => Boolean(opening));
    return {
      signature,
      repeated: recentOpenings.filter((opening) => opening === signature.openingPattern).length >= 2,
    };
  }
}

export class MultiPassReviewer {
  review(question: Question): MultiPassReviewOutcome {
    const issues: string[] = [];
    const writerPass = question.stem.trim().endsWith('?') && question.stem.split(/\s+/).length >= 40;
    if (!writerPass) {
      issues.push('writer-pass-failed');
    }

    const technicalPass = question.correctAnswers.length >= 1 && question.services.length >= 1;
    if (!technicalPass) {
      issues.push('technical-pass-failed');
    }

    const examPass = /(least|most|best|optimal|cost|resilien|operational)/i.test(question.stem);
    if (!examPass) {
      issues.push('exam-pass-failed');
    }

    return { passed: issues.length === 0, issues };
  }
}

export class DistractorQualityValidator {
  analyze(question: Question): { valid: boolean; analysis: DistractorAnalysisItem[]; issues: string[] } {
    const incorrectOptions = question.options.filter((option) => !question.correctAnswers.includes(option.label));
    const issues: string[] = [];
    const seenOptionTexts = new Set<string>();

    const analysis: DistractorAnalysisItem[] = incorrectOptions.map((option) => {
      const normalized = option.text.toLowerCase().replace(/\s+/g, ' ').trim();
      if (seenOptionTexts.has(normalized)) {
        issues.push(`duplicate-distractor-${option.label}`);
      }
      seenOptionTexts.add(normalized);
      if (GENERIC_DISTRACTOR_MARKERS.some((marker) => normalized.includes(marker))) {
        issues.push(`generic-distractor-${option.label}`);
      }

      let misconceptionClass = 'service-mismatch';
      if (/(manual|custom|self-managed|ad hoc)/i.test(option.text)) {
        misconceptionClass = 'operational-overhead-underestimation';
      } else if (/(single|one account|local admin)/i.test(option.text)) {
        misconceptionClass = 'governance-scalability-misconception';
      } else if (/(without|no )/i.test(option.text)) {
        misconceptionClass = 'resilience-control-gap';
      }

      return {
        label: option.label,
        misconceptionClass,
        reason: `Distractor ${option.label} reflects ${misconceptionClass}.`,
      };
    });

    return {
      valid: analysis.length > 0 && issues.length === 0,
      analysis,
      issues,
    };
  }
}

export class ExplanationRubricValidator {
  build(question: Question): { valid: boolean; rubric: ExplanationRubric; issues: string[] } {
    const issues: string[] = [];
    if (!question.explanation || question.explanation.split(/\s+/).length < 25) {
      issues.push('explanation-too-short');
    }

    const incorrectOptionRationales = question.options
      .filter((option) => !question.correctAnswers.includes(option.label))
      .map((option) => ({
        label: option.label,
        rationale: `Option ${option.label} is less suitable because it increases risk or operational burden for this scenario.`,
      }));

    if (incorrectOptionRationales.length === 0) {
      issues.push('missing-incorrect-option-rationales');
    }

    const rubric: ExplanationRubric = {
      correctOptionRationale:
        'The selected correct option set aligns with managed-service best practices, scenario constraints, and operational scalability goals.',
      incorrectOptionRationales,
    };

    return {
      valid: issues.length === 0,
      rubric,
      issues,
    };
  }
}

export class NoveltyGate {
  evaluate(question: Question, corpus: Question[], config: QualityPipelineConfig): { accepted: boolean; scores: NoveltyScores } {
    if (!config.noveltyEnabled) {
      throw new Error('Novelty service unavailable: QUALITY_NOVELTY_ENABLED=false');
    }

    let maxStem = 0;
    let maxExplanation = 0;
    for (const existing of corpus) {
      maxStem = Math.max(maxStem, jaccardSimilarity(question.stem, existing.stem));
      maxExplanation = Math.max(maxExplanation, jaccardSimilarity(question.explanation, existing.explanation));
    }

    const scores: NoveltyScores = {
      stemSimilarity: clamp01(maxStem),
      explanationSimilarity: clamp01(maxExplanation),
      thresholdVersion: `stem:${config.stemSimilarityThreshold}|exp:${config.explanationSimilarityThreshold}`,
    };

    return {
      accepted:
        scores.stemSimilarity < config.stemSimilarityThreshold &&
        scores.explanationSimilarity < config.explanationSimilarityThreshold,
      scores,
    };
  }
}

export class QualityKpiAggregator {
  static compute(questions: Question[], noveltyRejects: number, attempts: number): QualityKpiReport {
    const scenarioSignatures = new Set(
      questions
        .map((question) => question.scenarioProfile)
        .filter((profile): profile is ScenarioProfile => Boolean(profile))
        .map(
          (profile) =>
            `${profile.industry}|${profile.organizationSize}|${profile.geographyCompliance}|${profile.migrationMaturity}|${profile.businessObjective}`,
        ),
    );

    const openingSignatures = new Set(
      questions
        .map((question) => question.styleSignature?.openingPattern)
        .filter((opening): opening is string => Boolean(opening)),
    );

    const serviceCount = new Map<string, number>();
    for (const question of questions) {
      for (const service of question.services) {
        serviceCount.set(service, (serviceCount.get(service) ?? 0) + 1);
      }
    }
    const mostRepeatedService = [...serviceCount.values()].sort((a, b) => b - a)[0] ?? 0;

    const diversityIndex = questions.length === 0 ? 0 : scenarioSignatures.size / questions.length;
    const styleEntropyScore = questions.length === 0 ? 0 : openingSignatures.size / questions.length;
    const serviceRepetitionRatio = questions.length === 0 ? 0 : mostRepeatedService / questions.length;
    const noveltyRejectRate = attempts === 0 ? 0 : noveltyRejects / attempts;

    const reviewFlag =
      diversityIndex < 0.55 || styleEntropyScore < 0.4 || serviceRepetitionRatio > 0.7 || noveltyRejectRate > 0.25;

    return {
      diversityIndex: clamp01(diversityIndex),
      serviceRepetitionRatio: clamp01(serviceRepetitionRatio),
      styleEntropyScore: clamp01(styleEntropyScore),
      noveltyRejectRate: clamp01(noveltyRejectRate),
      reviewFlag,
      generatedAt: new Date().toISOString(),
    };
  }
}

export class QualityPipeline {
  private readonly scenarioProfileBuilder = new ScenarioProfileBuilder();
  private readonly styleEntropyGuard = new StyleEntropyGuard();
  private readonly multiPassReviewer = new MultiPassReviewer();
  private readonly distractorQualityValidator = new DistractorQualityValidator();
  private readonly explanationRubricValidator = new ExplanationRubricValidator();
  private readonly noveltyGate = new NoveltyGate();

  constructor(private readonly config: QualityPipelineConfig) {}

  maxRetries(): number {
    return this.config.qualityRetryLimit;
  }

  evaluateCandidate(
    question: Question,
    history: Question[],
    corpus: Question[],
    seedKey: string,
  ): GateResult {
    const decisions: QualityGateDecision[] = [];

    const scenarioProfile = this.scenarioProfileBuilder.build(seedKey);
    question.scenarioProfile = scenarioProfile;
    decisions.push({ gateId: 'scenario-diversity', result: 'pass', reasonCode: 'scenario-profile-assigned', severity: 'info' });

    const style = this.styleEntropyGuard.apply(
      question.stem,
      history,
      seedKey,
      this.config.styleRepetitionWindow,
    );
    question.styleSignature = style.signature;
    if (style.repeated) {
      decisions.push({ gateId: 'style-entropy', result: 'reject', reasonCode: 'opening-pattern-repeated', severity: 'blocking' });
      return {
        accepted: false,
        question,
        decisions,
        noveltyScores: { stemSimilarity: 0, explanationSimilarity: 0, thresholdVersion: 'n/a' },
      };
    }
    decisions.push({ gateId: 'style-entropy', result: 'pass', reasonCode: 'style-signature-accepted', severity: 'info' });

    const review = this.multiPassReviewer.review(question);
    question.multiPassReview = {
      passed: review.passed,
      results: [
        { pass: 'writer', valid: !review.issues.includes('writer-pass-failed'), issues: review.issues.filter((x) => x === 'writer-pass-failed') },
        { pass: 'technical', valid: !review.issues.includes('technical-pass-failed'), issues: review.issues.filter((x) => x === 'technical-pass-failed') },
        { pass: 'exam', valid: !review.issues.includes('exam-pass-failed'), issues: review.issues.filter((x) => x === 'exam-pass-failed') },
      ],
    };
    if (!review.passed) {
      decisions.push({ gateId: 'multi-pass-review', result: 'reject', reasonCode: review.issues.join(','), severity: 'blocking' });
      return {
        accepted: false,
        question,
        decisions,
        noveltyScores: { stemSimilarity: 0, explanationSimilarity: 0, thresholdVersion: 'n/a' },
      };
    }
    decisions.push({ gateId: 'multi-pass-review', result: 'pass', reasonCode: 'all-review-passes-succeeded', severity: 'info' });

    const distractorValidation = this.distractorQualityValidator.analyze(question);
    question.distractorAnalysis = distractorValidation.analysis;
    if (!distractorValidation.valid) {
      decisions.push({
        gateId: 'distractor-quality',
        result: 'reject',
        reasonCode: distractorValidation.issues.join(',') || 'distractor-validation-failed',
        severity: 'blocking',
      });
      return {
        accepted: false,
        question,
        decisions,
        noveltyScores: { stemSimilarity: 0, explanationSimilarity: 0, thresholdVersion: 'n/a' },
      };
    }
    decisions.push({ gateId: 'distractor-quality', result: 'pass', reasonCode: 'misconception-tags-assigned', severity: 'info' });

    const rubric = this.explanationRubricValidator.build(question);
    question.explanationRubric = rubric.rubric;
    if (!rubric.valid) {
      decisions.push({
        gateId: 'explanation-rubric',
        result: 'reject',
        reasonCode: rubric.issues.join(',') || 'explanation-rubric-failed',
        severity: 'blocking',
      });
      return {
        accepted: false,
        question,
        decisions,
        noveltyScores: { stemSimilarity: 0, explanationSimilarity: 0, thresholdVersion: 'n/a' },
      };
    }
    decisions.push({ gateId: 'explanation-rubric', result: 'pass', reasonCode: 'rubric-complete', severity: 'info' });

    const novelty = this.noveltyGate.evaluate(question, [...history, ...corpus], this.config);
    question.noveltyScores = novelty.scores;
    if (!novelty.accepted) {
      decisions.push({ gateId: 'novelty', result: 'reject', reasonCode: 'semantic-similarity-threshold-exceeded', severity: 'blocking' });
      return {
        accepted: false,
        question,
        decisions,
        noveltyScores: novelty.scores,
      };
    }
    decisions.push({ gateId: 'novelty', result: 'pass', reasonCode: 'below-similarity-thresholds', severity: 'info' });

    question.qualityGateDecisions = decisions;
    return {
      accepted: true,
      question,
      decisions,
      noveltyScores: novelty.scores,
    };
  }
}

export const countNoveltyRejects = (decisions: QualityGateDecision[]): number =>
  decisions.filter((decision) => decision.gateId === 'novelty' && decision.result === 'reject').length;
