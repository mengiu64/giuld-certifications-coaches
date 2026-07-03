import { z } from 'zod';
export const questionFormatSchema = z.enum(['single-4', 'multi-5', 'multi-6']);
export const questionLabelSchema = z.enum(['A', 'B', 'C', 'D', 'E', 'F']);
export const certificationLevelSchema = z.enum(['professional', 'associate', 'specialty']);
export const examModeSchema = z.enum(['exam', 'study']);
export const examSessionStatusSchema = z.enum(['in_progress', 'submitted', 'paused']);
export const generationStateSchema = z.enum(['idle', 'running', 'completed', 'failed']);
export const questionOptionSchema = z.object({
    label: questionLabelSchema,
    text: z.string().min(10),
});
export const generatedQuestionDraftSchema = z.object({
    stem: z.string().min(50).max(2000),
    options: z.array(questionOptionSchema).min(4).max(6),
    correctAnswers: z.array(z.string().min(1)).min(1).max(3),
    domain: z.string().min(1),
    services: z.array(z.string().min(2)).min(1).max(3),
    explanation: z.string().min(50).max(3000),
    format: questionFormatSchema,
    referenceUrl: z.string().url().optional(),
});
export const questionSchema = generatedQuestionDraftSchema.extend({
    questionId: z.string().uuid(),
});
export const questionBankSchema = z.object({
    bankId: z.string().uuid(),
    certificationId: z.string().min(1),
    certificationName: z.string().min(1),
    examCode: z.string().min(1),
    createdAt: z.string().datetime(),
    questions: z.array(questionSchema),
});
export const studyQuestionResultSchema = z.object({
    questionIndex: z.number().int().min(0),
    selectedAnswers: z.array(z.string().min(1)),
    isCorrect: z.boolean(),
    answeredAt: z.string().datetime(),
});
export const examSessionSchema = z.object({
    sessionId: z.string().uuid(),
    bankId: z.string().uuid(),
    certificationId: z.string().min(1),
    mode: examModeSchema,
    status: examSessionStatusSchema,
    startedAt: z.string().datetime(),
    timeRemainingMs: z.number().int().min(0),
    questionOrder: z.array(z.number().int().min(0)),
    answers: z.array(z.tuple([z.number().int().min(0), z.array(z.string().min(1))])),
    markedForReview: z.array(z.number().int().min(0)),
    studyResults: z.array(studyQuestionResultSchema).optional(),
});
export const examResultSchema = z.object({
    sessionId: z.string().uuid(),
    bankId: z.string().uuid(),
    completedAt: z.string().datetime(),
    score: z.number().int().min(0).max(100),
    passed: z.boolean(),
    totalQuestions: z.number().int().min(0),
    correctCount: z.number().int().min(0),
    domainBreakdown: z.record(z.object({ correct: z.number().int().min(0), total: z.number().int().min(0) })),
});
export const certificationDomainSchema = z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    percentage: z.number().min(0).max(100),
});
export const certificationConfigSchema = z.object({
    id: z.string().min(1),
    displayName: z.string().min(1),
    examCode: z.string().min(1),
    level: certificationLevelSchema,
    domains: z.array(certificationDomainSchema).min(1),
    formatDistribution: z.object({
        singleAnswer4Options: z.number().min(0).max(100),
        multiAnswer5Options: z.number().min(0).max(100),
        multiAnswer6Options: z.number().min(0).max(100),
    }),
    totalQuestions: z.number().int().positive(),
    timeLimitMinutes: z.number().int().positive(),
});
export const questionBankSummarySchema = z.object({
    bankId: z.string().uuid(),
    certificationId: z.string().min(1),
    certificationName: z.string().min(1),
    examCode: z.string().min(1),
    createdAt: z.string().datetime(),
    questionCount: z.number().int().min(0),
});
export const documentationResultSchema = z.object({
    title: z.string().min(1),
    url: z.string().url(),
    snippet: z.string().min(1),
    service: z.string().min(1),
    domain: z.string().min(1),
    source: z.literal('aws-docs-mock'),
});
export const generationStatusSchema = z.object({
    state: generationStateSchema,
    certificationId: z.string().optional(),
    bankId: z.string().uuid().optional(),
    generatedQuestions: z.number().int().min(0),
    targetQuestions: z.number().int().min(0),
    startedAt: z.string().datetime().optional(),
    updatedAt: z.string().datetime(),
    lastError: z.string().optional(),
    message: z.string().min(1),
    checkpointPath: z.string().optional(),
});
export const generationCheckpointSchema = z.object({
    certificationId: z.string().min(1),
    bankId: z.string().uuid(),
    createdAt: z.string().datetime(),
    questionCount: z.number().int().min(0),
    questions: z.array(questionSchema),
    updatedAt: z.string().datetime(),
});
//# sourceMappingURL=schemas.js.map