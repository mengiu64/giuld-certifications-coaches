import type { GeneratedQuestionDraft, Question } from '@aws-exam-generator/shared';
interface ValidationResult {
    valid: boolean;
    errors: string[];
}
export declare class QuestionValidator {
    static normalizeDraft(draft: GeneratedQuestionDraft): GeneratedQuestionDraft;
    static validateQuestion(question: GeneratedQuestionDraft | Question): ValidationResult;
    static assertValidQuestion(question: GeneratedQuestionDraft | Question): void;
}
export {};
