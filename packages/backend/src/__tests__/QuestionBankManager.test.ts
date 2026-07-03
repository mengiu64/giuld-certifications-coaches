import { afterAll, beforeEach, describe, expect, it } from '@jest/globals';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { v4 as uuidv4 } from 'uuid';
import { certificationRegistry, type QuestionBank } from '@aws-exam-generator/shared';
import { QuestionBankManager } from '../agent/QuestionBankManager.js';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const fixtureRoot = path.resolve(currentDirectory, '../../../.test-artifacts/question-bank-manager');

const buildQuestionBank = (): QuestionBank => ({
  bankId: uuidv4(),
  certificationId: 'SAP-C02',
  certificationName: 'AWS Certified Solutions Architect - Professional',
  examCode: 'SAP-C02',
  createdAt: new Date().toISOString(),
  questions: [
    {
      questionId: uuidv4(),
      stem: 'A global retailer is redesigning a multi-account AWS environment to improve operational governance, reduce manual approvals, and centralize shared services while supporting hundreds of developers across Regions. The leadership team wants a managed approach that keeps workloads autonomous but enforces preventive guardrails, audit visibility, and scalable account provisioning. Which solution should the architect recommend to meet these requirements with the least ongoing administrative effort?',
      options: [
        { label: 'A', text: 'Adopt AWS Control Tower and Organizations with account factory and preventive guardrails for every landing zone account.' },
        { label: 'B', text: 'Maintain one shared AWS account and rely on naming conventions to separate application teams and audit duties.' },
        { label: 'C', text: 'Provision every account manually and distribute account root credentials to operational owners for urgent access.' },
        { label: 'D', text: 'Deploy self-managed directory services in each VPC and avoid centralized governance tooling to reduce dependencies.' },
      ],
      correctAnswers: ['A'],
      domain: 'design-solutions-organizational-complexity',
      services: ['Organizations', 'Control Tower'],
      explanation: 'AWS Control Tower uses AWS Organizations guardrails, account vending, and centralized governance capabilities to scale secure multi-account operations. Combining Organizations and Control Tower reduces manual toil while keeping preventive and detective controls aligned across teams and Regions.',
      format: 'single-4',
      referenceUrl: 'https://docs.aws.amazon.com/controltower/latest/userguide/what-is-control-tower.html',
    },
  ],
});

describe('QuestionBankManager', () => {
  beforeEach(async () => {
    await fs.rm(fixtureRoot, { recursive: true, force: true });
    await fs.mkdir(fixtureRoot, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(fixtureRoot, { recursive: true, force: true });
  });

  it('saves and loads banks atomically from the filesystem', async () => {
    const manager = new QuestionBankManager(fixtureRoot, certificationRegistry);
    const bank = buildQuestionBank();
    await manager.saveQuestionBank(bank);

    const loaded = await manager.getBank(bank.bankId);
    expect(loaded).not.toBeNull();
    expect(loaded?.bankId).toBe(bank.bankId);
    expect(loaded?.questions).toHaveLength(1);
  });

  it('lists summaries sorted by creation date descending', async () => {
    const manager = new QuestionBankManager(fixtureRoot, certificationRegistry);
    const older = buildQuestionBank();
    older.createdAt = '2024-01-01T00:00:00.000Z';
    const newer = buildQuestionBank();
    newer.createdAt = '2024-02-01T00:00:00.000Z';
    await manager.saveQuestionBank(older);
    await manager.saveQuestionBank(newer);

    const summaries = await manager.listBanks();
    expect(summaries.map((summary) => summary.bankId)).toEqual([newer.bankId, older.bankId]);
  });
});
