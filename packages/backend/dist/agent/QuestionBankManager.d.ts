import { type CertificationRegistry, type GenerationCheckpoint, type Question, type QuestionBank, type QuestionBankSummary } from '@aws-exam-generator/shared';
export declare class QuestionBankManager {
    private readonly dataDir;
    private readonly certificationRegistry;
    constructor(dataDir: string, certificationRegistry: CertificationRegistry);
    listBanks(): Promise<QuestionBankSummary[]>;
    getBank(bankId: string): Promise<QuestionBank | null>;
    getLatestBank(certificationId: string): Promise<QuestionBank | null>;
    getLatestQuestions(certificationId: string): Promise<Question[]>;
    saveQuestion(question: Question, certificationId?: string): Promise<Question>;
    saveQuestionBank(bank: QuestionBank): Promise<QuestionBank>;
    writeCheckpoint(checkpointPath: string, checkpoint: GenerationCheckpoint): Promise<void>;
    clearCheckpoint(checkpointPath: string): Promise<void>;
    private atomicWrite;
}
