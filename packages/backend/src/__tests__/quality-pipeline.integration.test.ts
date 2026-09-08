import { beforeEach, describe, expect, it } from '@jest/globals';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import type {
  CertificationConfig,
  CertificationRegistry,
  Question,
  QuestionFormat,
} from '@aws-exam-generator/shared';
import { ExamAgentController } from '../agent/ExamAgentController.js';
import { QualityPipeline } from '../agent/QualityPipeline.js';
import { QuestionBankManager } from '../agent/QuestionBankManager.js';
import type { QuestionGenerator } from '../agent/QuestionGenerator.js';

const fixtureRoot = path.join(os.tmpdir(), 'aws-exam-generator-tests', 'quality-pipeline-integration');
const checkpointPath = path.join(fixtureRoot, 'checkpoint.json');
const scenarioVariants = [
  'healthcare-data-residency',
  'payments-tokenization',
  'media-streaming-governance',
  'industrial-iot-segmentation',
] as const;

const certification: CertificationConfig = {
  id: 'sap-c02-integration',
  displayName: 'SAP-C02 Integration',
  examCode: 'SAP-C02',
  level: 'professional',
  domains: [
    { id: 'design-solutions-organizational-complexity', name: 'D1', percentage: 100 },
  ],
  formatDistribution: {
    singleAnswer4Options: 100,
    multiAnswer5Options: 0,
    multiAnswer6Options: 0,
  },
  totalQuestions: 4,
  timeLimitMinutes: 180,
};

const registry: CertificationRegistry = {
  getAll: () => ({ professional: [certification], associate: [], specialty: [] }),
  getById: (id: string) => (id === certification.id ? certification : null),
  getByLevel: () => [certification],
};

const buildQuestion = (index: number, format: QuestionFormat): Question => {
  const variant = scenarioVariants[index % scenarioVariants.length];
  return {
    questionId: uuidv4(),
    stem: `A regulated enterprise is evaluating account governance and resilience controls for migration wave ${index} in the ${variant} initiative, while operating critical workloads across Regions with strict audit, disaster-recovery, and data-residency obligations. Leadership requires a managed operating model that minimizes manual toil, scales delegated administration, enforces preventive guardrails, and preserves cost efficiency under variable traffic. Which solution should the architect recommend to satisfy these goals with the least operational overhead?`,
    options: [
      { label: 'A', text: 'Use AWS Organizations with SCP guardrails and delegated admin in a landing zone model.' },
      { label: 'B', text: 'Use ad hoc scripts and manual account operations for governance decisions.' },
      { label: 'C', text: 'Use one account and local admin users without central policy enforcement.' },
      { label: 'D', text: 'Use spreadsheet approvals and no automated controls for account provisioning.' },
    ],
    correctAnswers: ['A'],
    domain: 'design-solutions-organizational-complexity',
    services: ['AWS Organizations', 'AWS IAM Identity Center'],
    explanation:
      `Managed governance with Organizations and IAM Identity Center provides scalable controls and reduced operational burden for wave ${index} in the ${variant} initiative while improving resilience, auditability, and lifecycle consistency for multi-account programs.`,
    format,
    referenceUrl: 'https://docs.aws.amazon.com/organizations/',
  };
};

const waitForCompletion = async (controller: ExamAgentController): Promise<void> => {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const status = controller.getStatus();
    if (status.state === 'completed') {
      return;
    }
    if (status.state === 'failed') {
      throw new Error(status.lastError ?? 'generation failed');
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('timeout waiting generation completion');
};

describe('Quality pipeline integration', () => {
  beforeEach(async () => {
    await fs.rm(fixtureRoot, { recursive: true, force: true });
    await fs.mkdir(fixtureRoot, { recursive: true });
  });

  it('generates a bank with quality metadata and KPI report', async () => {
    let counter = 0;
    const generator = {
      async generateQuestion(_cert: CertificationConfig, _domainId: string, format: QuestionFormat): Promise<Question> {
        counter += 1;
        return buildQuestion(counter, format);
      },
    } as unknown as QuestionGenerator;

    const manager = new QuestionBankManager(fixtureRoot, registry);
    const pipeline = new QualityPipeline({
      noveltyEnabled: true,
      stemSimilarityThreshold: 0.999,
      explanationSimilarityThreshold: 0.999,
      qualityRetryLimit: 3,
      styleRepetitionWindow: 6,
    });
    const controller = new ExamAgentController(generator, manager, registry, checkpointPath, pipeline);

    await controller.startGeneration(certification.id);
    await waitForCompletion(controller);

    const status = controller.getStatus();
    expect(status.state).toBe('completed');
    expect(status.qualityKpis).toBeDefined();

    const bank = await manager.getLatestBank(certification.id);
    expect(bank).not.toBeNull();
    expect(bank?.questions).toHaveLength(certification.totalQuestions);
    expect(bank?.qualityKpis).toBeDefined();
    expect(bank?.questions.every((q) => q.scenarioProfile && q.styleSignature && q.multiPassReview && q.qualityGateDecisions)).toBe(true);
  });
});
