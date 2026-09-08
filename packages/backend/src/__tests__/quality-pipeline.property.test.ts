import { describe, expect, it } from '@jest/globals';
import fc from 'fast-check';
import type { CertificationConfig, GenerationPlanItem, Question } from '@aws-exam-generator/shared';
import { DomainUseCasePlanner, NoveltyGate, ScenarioProfileBuilder, StyleEntropyGuard } from '../agent/QualityPipeline.js';

const baseQuestion = (id: number): Question => ({
  questionId: `00000000-0000-4000-8000-${String(id).padStart(12, '0')}`,
  stem: `A global enterprise is redesigning governance across accounts and regions for workload ${id}, requiring the best resilient and cost-optimized architecture with least operational overhead and strong security controls. Which approach should the architect choose?`,
  options: [
    { label: 'A', text: 'Adopt managed governance controls with centralized guardrails and delegated administration.' },
    { label: 'B', text: 'Keep manual account setup and local admin ownership for each team.' },
    { label: 'C', text: 'Use ad hoc scripts and no standardized observability policies across workloads.' },
    { label: 'D', text: 'Use a single shared account for all workloads without isolation boundaries.' },
  ],
  correctAnswers: ['A'],
  domain: 'design-solutions-organizational-complexity',
  services: ['AWS Organizations', 'AWS IAM Identity Center'],
  explanation: `Managed controls and centralized governance reduce operational overhead while preserving resilience for workload ${id}.`,
  format: 'single-4',
});

describe('Quality pipeline property invariants', () => {
  it('ScenarioProfileBuilder is deterministic for the same seed', () => {
    const builder = new ScenarioProfileBuilder();

    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 40 }), (seed) => {
        const a = builder.build(seed);
        const b = builder.build(seed);
        expect(a).toEqual(b);
      }),
      { numRuns: 80 },
    );
  });

  it('DomainUseCasePlanner assigns useCaseFamily to all plan items', () => {
    const planner = new DomainUseCasePlanner();
    const cert: CertificationConfig = {
      id: 'cert-prop',
      displayName: 'cert-prop',
      examCode: 'CP-001',
      level: 'professional',
      domains: [
        { id: 'design-solutions-organizational-complexity', name: 'd1', percentage: 50 },
        { id: 'unknown-domain', name: 'd2', percentage: 50 },
      ],
      formatDistribution: { singleAnswer4Options: 100, multiAnswer5Options: 0, multiAnswer6Options: 0 },
      totalQuestions: 20,
      timeLimitMinutes: 120,
    };

    fc.assert(
      fc.property(fc.array(fc.constantFrom('design-solutions-organizational-complexity', 'unknown-domain'), { minLength: 1, maxLength: 50 }), (domains) => {
        const plan: GenerationPlanItem[] = domains.map((domainId) => ({ domainId, format: 'single-4' }));
        planner.assign(plan, cert);
        expect(plan.every((item) => typeof item.useCaseFamily === 'string' && item.useCaseFamily.length > 0)).toBe(true);
      }),
      { numRuns: 60 },
    );
  });

  it('StyleEntropyGuard flags repeated opening patterns in the active window', () => {
    const guard = new StyleEntropyGuard();
    const signature = guard.apply('stem', [], 'fixed-seed', 6).signature;
    const history: Question[] = [
      { ...baseQuestion(1), styleSignature: signature },
      { ...baseQuestion(2), styleSignature: signature },
      baseQuestion(3),
    ];

    const result = guard.apply('stem', history, 'fixed-seed', 6);
    expect(result.repeated).toBe(true);
  });

  it('NoveltyGate rejects identical content when thresholds are strict', () => {
    const gate = new NoveltyGate();
    const current = baseQuestion(7);
    const corpus = [baseQuestion(7)];

    const result = gate.evaluate(current, corpus, {
      noveltyEnabled: true,
      stemSimilarityThreshold: 0.99,
      explanationSimilarityThreshold: 0.99,
      qualityRetryLimit: 3,
      styleRepetitionWindow: 6,
    });

    expect(result.accepted).toBe(false);
  });
});
