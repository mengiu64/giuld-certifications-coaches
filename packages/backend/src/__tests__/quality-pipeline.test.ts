import { describe, expect, it } from '@jest/globals';
import type { CertificationConfig, GenerationPlanItem, Question } from '@aws-exam-generator/shared';
import { DomainUseCasePlanner, QualityKpiAggregator, QualityPipeline } from '../agent/QualityPipeline.js';

const baseQuestion = (overrides: Partial<Question> = {}): Question => ({
  questionId: 'q-1',
  stem: 'A global enterprise is planning a multi-account AWS architecture for regulated workloads across regions and wants the most cost-effective and resilient design with centralized governance, delegated administration, continuous compliance checks, workload isolation, controlled service limits, scalable security operations, and repeatable platform automation for migration programs. Which approach should the solutions architect choose?',
  options: [
    { label: 'A', text: 'Use AWS Organizations with SCP guardrails and delegated admin for centralized governance.' },
    { label: 'B', text: 'Use one account per workload and manual IAM setup for each team.' },
    { label: 'C', text: 'Use self-managed scripts for ad hoc access control reviews per project.' },
    { label: 'D', text: 'Use local account administrators with no cross-account controls.' },
  ],
  correctAnswers: ['A'],
  domain: 'design-solutions-organizational-complexity',
  services: ['AWS Organizations', 'AWS IAM Identity Center'],
  explanation:
    'AWS Organizations with SCPs and delegated administration aligns governance with scale, keeps guardrails consistent, reduces operational overhead, and supports resilient multi-account landing-zone operations for regulated workloads where central controls and auditability are mandatory.',
  format: 'single-4',
  ...overrides,
});

const baseConfig = {
  noveltyEnabled: true,
  stemSimilarityThreshold: 0.92,
  explanationSimilarityThreshold: 0.9,
  qualityRetryLimit: 3,
  styleRepetitionWindow: 6,
};

describe('QualityPipeline', () => {
  it('annotates and accepts a valid novel question', () => {
    const pipeline = new QualityPipeline(baseConfig);
    const candidate = baseQuestion();

    const result = pipeline.evaluateCandidate(candidate, [], [], 'seed-1');

    expect(result.accepted).toBe(true);
    expect(result.question.scenarioProfile).toBeDefined();
    expect(result.question.styleSignature).toBeDefined();
    expect(result.question.multiPassReview?.passed).toBe(true);
    expect(result.question.distractorAnalysis).toHaveLength(3);
    expect(result.question.explanationRubric?.incorrectOptionRationales).toHaveLength(3);
    expect(result.question.noveltyScores?.stemSimilarity).toBe(0);
    expect(result.question.qualityGateDecisions?.every((decision) => decision.result === 'pass')).toBe(true);
  });

  it('rejects candidate when novelty threshold is exceeded', () => {
    const pipeline = new QualityPipeline(baseConfig);
    const existing = baseQuestion({ questionId: 'existing-1' });
    const candidate = baseQuestion({ questionId: 'candidate-1' });

    const result = pipeline.evaluateCandidate(candidate, [existing], [], 'seed-2');

    expect(result.accepted).toBe(false);
    expect(result.noveltyScores.stemSimilarity).toBeGreaterThanOrEqual(baseConfig.stemSimilarityThreshold);
    expect(result.decisions.some((decision) => decision.gateId === 'novelty' && decision.result === 'reject')).toBe(true);
  });
});

describe('DomainUseCasePlanner', () => {
  it('assigns useCaseFamily to every plan item by domain', () => {
    const planner = new DomainUseCasePlanner();
    const certification: CertificationConfig = {
      id: 'sap-c02',
      displayName: 'AWS Certified Solutions Architect - Professional',
      examCode: 'SAP-C02',
      level: 'professional',
      totalQuestions: 4,
      timeLimitMinutes: 180,
      formatDistribution: {
        singleAnswer4Options: 100,
        multiAnswer5Options: 0,
        multiAnswer6Options: 0,
      },
      domains: [
        { id: 'design-solutions-organizational-complexity', name: 'D1', percentage: 50 },
        { id: 'unknown-domain', name: 'D2', percentage: 50 },
      ],
    };

    const plan: GenerationPlanItem[] = [
      { domainId: 'design-solutions-organizational-complexity', format: 'single-4' },
      { domainId: 'design-solutions-organizational-complexity', format: 'single-4' },
      { domainId: 'unknown-domain', format: 'single-4' },
      { domainId: 'unknown-domain', format: 'single-4' },
    ];

    planner.assign(plan, certification);

    expect(plan.every((item) => typeof item.useCaseFamily === 'string' && item.useCaseFamily.length > 0)).toBe(true);
    expect(plan.filter((item) => item.domainId === 'unknown-domain').every((item) => item.useCaseFamily === 'core-architecture')).toBe(true);
  });
});

describe('QualityKpiAggregator', () => {
  it('computes normalized KPIs and review flag thresholds', () => {
    const questions = [
      baseQuestion({ questionId: 'q-1', services: ['EC2'] }),
      baseQuestion({ questionId: 'q-2', services: ['EC2'] }),
      baseQuestion({ questionId: 'q-3', services: ['S3'] }),
    ];
    questions[0]!.scenarioProfile = {
      industry: 'financial-services',
      organizationSize: 'enterprise',
      geographyCompliance: 'eu-multi-region-gdpr',
      migrationMaturity: 'hybrid',
      businessObjective: 'improve-governance-and-security',
    };
    questions[1]!.scenarioProfile = { ...questions[0]!.scenarioProfile };
    questions[2]!.scenarioProfile = {
      industry: 'retail',
      organizationSize: 'mid-market',
      geographyCompliance: 'global-pci-dss',
      migrationMaturity: 'greenfield',
      businessObjective: 'optimize-latency-and-cost',
    };
    questions[0]!.styleSignature = { openingPattern: 'A global enterprise is', decisionIntent: 'highest-resilience', rhetoricalShape: 'single-decision' };
    questions[1]!.styleSignature = { openingPattern: 'A global enterprise is', decisionIntent: 'highest-resilience', rhetoricalShape: 'single-decision' };
    questions[2]!.styleSignature = { openingPattern: 'A fast-growing company is', decisionIntent: 'best-cost-performance', rhetoricalShape: 'tradeoff-choice' };

    const kpis = QualityKpiAggregator.compute(questions, 2, 8);

    expect(kpis.diversityIndex).toBeCloseTo(2 / 3, 5);
    expect(kpis.serviceRepetitionRatio).toBeCloseTo(2 / 3, 5);
    expect(kpis.styleEntropyScore).toBeCloseTo(2 / 3, 5);
    expect(kpis.noveltyRejectRate).toBeCloseTo(0.25, 5);
    expect(typeof kpis.reviewFlag).toBe('boolean');
  });
});
