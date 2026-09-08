import { beforeAll, describe, expect, it } from '@jest/globals';
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
import { QuestionBankManager } from '../agent/QuestionBankManager.js';
import { ExamAgentController } from '../agent/ExamAgentController.js';
import { QualityPipeline } from '../agent/QualityPipeline.js';
import type { QuestionGenerator } from '../agent/QuestionGenerator.js';

const fixtureRoot = path.join(os.tmpdir(), 'aws-exam-generator-tests', 'generation-status-api');
const checkpointPath = path.join(fixtureRoot, 'checkpoint.json');
const scenarioVariants = [
  'mainframe-retirement',
  'data-mesh-expansion',
  'contact-center-modernization',
  'global-erp-segmentation',
] as const;

const certification: CertificationConfig = {
  id: 'sap-c02-test',
  displayName: 'SAP-C02 Test',
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
  totalQuestions: 3,
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
    stem: `A global enterprise is modernizing workload wave ${index} for ${variant} across regulated regions and multi-account environments, while integrating legacy identity boundaries, centralized observability controls, delegated administration, and automated compliance checks for multiple product teams. The platform leadership requires a design that minimizes operational toil, preserves resilience under regional failures, and provides cost-aware guardrails for long-term expansion. Which solution provides the least operational overhead while keeping governance and security controls effective at scale?`,
    options: [
      { label: 'A', text: 'Use AWS Organizations with SCP guardrails, delegated administrators, and centralized identity governance controls.' },
      { label: 'B', text: 'Use manual per-account scripts and spreadsheet-based compliance tracking processes.' },
      { label: 'C', text: 'Use local account admins and no centralized governance standards for workloads.' },
      { label: 'D', text: 'Use one account for all workloads and ad hoc permission management.' },
    ],
    correctAnswers: ['A'],
    domain: 'design-solutions-organizational-complexity',
    services: ['AWS Organizations', 'AWS IAM Identity Center'],
    explanation:
      `AWS Organizations and IAM Identity Center provide centralized governance, delegated administration, and reduced operational overhead for migration wave ${index} in the ${variant} program while enabling scalable controls and resilient multi-account operations for enterprise workloads.`,
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

describe('Generation status quality fields', () => {
  beforeAll(async () => {
    await fs.rm(fixtureRoot, { recursive: true, force: true });
    await fs.mkdir(fixtureRoot, { recursive: true });
  });

  it('exposes qualityKpis and reviewFlag when generation completes', async () => {
    let callCount = 0;
    const generator = {
      async generateQuestion(
        _cert: CertificationConfig,
        _domainId: string,
        format: QuestionFormat,
      ): Promise<Question> {
        callCount += 1;
        return buildQuestion(callCount, format);
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
    expect(typeof status.reviewFlag).toBe('boolean');
    expect(status.qualityKpis?.generatedAt).toMatch(/\d{4}-\d{2}-\d{2}T/);
  });
});
