import fs from 'node:fs/promises';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import {
  DEFAULT_CERTIFICATION_ID,
  generationCheckpointSchema,
  questionBankSchema,
  questionSchema,
  type CertificationRegistry,
  type GenerationCheckpoint,
  type Question,
  type QuestionBank,
  type QuestionBankSummary,
} from '@aws-exam-generator/shared';

export class QuestionBankManager {
  constructor(
    private readonly dataDir: string,
    private readonly certificationRegistry: CertificationRegistry,
  ) {}

  async listBanks(): Promise<QuestionBankSummary[]> {
    const certificationEntries = await fs.readdir(this.dataDir, { withFileTypes: true }).catch(() => []);
    const summaries: QuestionBankSummary[] = [];

    for (const entry of certificationEntries) {
      if (!entry.isDirectory()) {
        continue;
      }
      const directoryPath = path.join(this.dataDir, entry.name);
      const files = await fs.readdir(directoryPath).catch(() => []);
      for (const file of files.filter((candidate) => candidate.endsWith('.json'))) {
        const fullPath = path.join(directoryPath, file);
        const raw = await fs.readFile(fullPath, 'utf-8');
        const bank = questionBankSchema.parse(JSON.parse(raw));
        summaries.push({
          bankId: bank.bankId,
          certificationId: bank.certificationId,
          certificationName: bank.certificationName,
          examCode: bank.examCode,
          createdAt: bank.createdAt,
          questionCount: bank.questions.length,
        });
      }
    }

    return summaries.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async getBank(bankId: string): Promise<QuestionBank | null> {
    const banks = await this.listBanks();
    const summary = banks.find((candidate) => candidate.bankId === bankId);
    if (!summary) {
      return null;
    }
    const filePath = path.join(this.dataDir, summary.certificationId, `${summary.bankId}.json`);
    const raw = await fs.readFile(filePath, 'utf-8');
    return questionBankSchema.parse(JSON.parse(raw));
  }

  async getLatestBank(certificationId: string): Promise<QuestionBank | null> {
    const directoryPath = path.join(this.dataDir, certificationId);
    const files = await fs.readdir(directoryPath).catch(() => []);
    const banks = await Promise.all(
      files
        .filter((candidate) => candidate.endsWith('.json'))
        .map(async (file) => {
          const raw = await fs.readFile(path.join(directoryPath, file), 'utf-8');
          return questionBankSchema.parse(JSON.parse(raw));
        }),
    );
    return banks.sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null;
  }

  async getLatestQuestions(certificationId: string): Promise<Question[]> {
    const bank = await this.getLatestBank(certificationId);
    return bank?.questions ?? [];
  }

  async saveQuestion(question: Question, certificationId: string = DEFAULT_CERTIFICATION_ID): Promise<Question> {
    questionSchema.parse(question);
    const certification = this.certificationRegistry.getById(certificationId);
    if (!certification) {
      throw new Error(`Unknown certification: ${certificationId}`);
    }
    const latest = await this.getLatestBank(certificationId);
    const bank: QuestionBank = latest ?? {
      bankId: uuidv4(),
      certificationId: certification.id,
      certificationName: certification.displayName,
      examCode: certification.examCode,
      createdAt: new Date().toISOString(),
      questions: [],
    };
    bank.questions.push(question);
    await this.saveQuestionBank(bank);
    return question;
  }

  async saveQuestionBank(bank: QuestionBank): Promise<QuestionBank> {
    const parsed = questionBankSchema.parse(bank);
    const certificationDir = path.join(this.dataDir, parsed.certificationId);
    await fs.mkdir(certificationDir, { recursive: true });
    const filePath = path.join(certificationDir, `${parsed.bankId}.json`);
    await this.atomicWrite(filePath, JSON.stringify(parsed, null, 2));
    return parsed;
  }

  async writeCheckpoint(checkpointPath: string, checkpoint: GenerationCheckpoint): Promise<void> {
    const parsed = generationCheckpointSchema.parse(checkpoint);
    await fs.mkdir(path.dirname(checkpointPath), { recursive: true });
    await this.atomicWrite(checkpointPath, JSON.stringify(parsed, null, 2));
  }

  async clearCheckpoint(checkpointPath: string): Promise<void> {
    await fs.rm(checkpointPath, { force: true });
  }

  private async atomicWrite(filePath: string, payload: string): Promise<void> {
    const tempPath = `${filePath}.tmp-${process.pid}`;
    await fs.writeFile(tempPath, payload, 'utf-8');
    await fs.rename(tempPath, filePath);
  }
}
