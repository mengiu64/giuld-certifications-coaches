import { type CertificationRegistry, type GenerationStatus } from '@aws-exam-generator/shared';
import { QuestionBankManager } from './QuestionBankManager.js';
import { QuestionGenerator } from './QuestionGenerator.js';
export declare class ExamAgentController {
    private readonly questionGenerator;
    private readonly questionBankManager;
    private readonly certificationRegistry;
    private readonly checkpointPath;
    private active;
    private status;
    constructor(questionGenerator: QuestionGenerator, questionBankManager: QuestionBankManager, certificationRegistry: CertificationRegistry, checkpointPath: string);
    getStatus(): GenerationStatus;
    startGeneration(certificationId?: string): Promise<GenerationStatus>;
    private runGeneration;
    private buildPlan;
}
