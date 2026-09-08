import { describe, expect, it } from '@jest/globals';
import { v4 as uuidv4 } from 'uuid';
import type { Question } from '@aws-exam-generator/shared';
import { NoveltyGate, QualityPipeline } from '../agent/QualityPipeline.js';

const createQuestion = (id: number): Question => ({
  questionId: uuidv4(),
  stem: `A global organization is evaluating migration governance architecture option ${id} across multi-account regions and requires the best resilient and cost-aware strategy with minimal operational overhead. Which approach should the architect choose?`,
  options: [
    { label: 'A', text: 'Use managed governance controls and delegated administration in multi-account structure.' },
    { label: 'B', text: 'Use manual access workflows with no centralized governance.' },
    { label: 'C', text: 'Use a single account and local administrators for all workloads.' },
    { label: 'D', text: 'Use ad hoc scripts and weekly manual policy reviews.' },
  ],
  correctAnswers: ['A'],
  domain: 'design-solutions-organizational-complexity',
  services: ['AWS Organizations', 'AWS IAM Identity Center'],
  explanation: `Managed governance for option ${id} improves reliability, operational efficiency, and compliance with less administrative burden.`,
  format: 'single-4',
});

const millis = (): number => Number(process.hrtime.bigint()) / 1_000_000;

describe('Quality pipeline performance budget', () => {
  it('keeps full-quality overhead within 35% vs novelty-baseline', () => {
    const corpus = Array.from({ length: 350 }, (_, index) => createQuestion(index + 1));
    const history = corpus.slice(0, 25);
    const candidate = createQuestion(9999);

    const noveltyGate = new NoveltyGate();
    const pipeline = new QualityPipeline({
      noveltyEnabled: true,
      stemSimilarityThreshold: 1,
      explanationSimilarityThreshold: 1,
      qualityRetryLimit: 3,
      styleRepetitionWindow: 6,
    });

    const iterations = 80;

    const baselineStart = millis();
    for (let i = 0; i < iterations; i += 1) {
      noveltyGate.evaluate(candidate, corpus, {
        noveltyEnabled: true,
        stemSimilarityThreshold: 1,
        explanationSimilarityThreshold: 1,
        qualityRetryLimit: 3,
        styleRepetitionWindow: 6,
      });
    }
    const baselineMs = millis() - baselineStart;

    const fullStart = millis();
    for (let i = 0; i < iterations; i += 1) {
      pipeline.evaluateCandidate({ ...candidate, questionId: uuidv4() }, history, corpus, `perf-${i}`);
    }
    const fullMs = millis() - fullStart;

    const overheadRatio = baselineMs <= 0 ? 0 : (fullMs - baselineMs) / baselineMs;
    expect(overheadRatio).toBeLessThanOrEqual(0.35);
  });
});
