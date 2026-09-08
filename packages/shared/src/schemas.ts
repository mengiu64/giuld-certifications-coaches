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

export const scenarioProfileSchema = z.object({
  industry: z.string().min(1),
  organizationSize: z.enum(['startup', 'mid-market', 'enterprise']),
  geographyCompliance: z.string().min(1),
  migrationMaturity: z.enum(['greenfield', 'brownfield', 'hybrid']),
  businessObjective: z.string().min(1),
});

export const styleSignatureSchema = z.object({
  openingPattern: z.string().min(1),
  decisionIntent: z.string().min(1),
  rhetoricalShape: z.string().min(1),
});

export const distractorAnalysisItemSchema = z.object({
  label: questionLabelSchema,
  misconceptionClass: z.string().min(1),
  reason: z.string().min(1),
});

export const optionRationaleSchema = z.object({
  label: questionLabelSchema,
  rationale: z.string().min(1),
});

export const explanationRubricSchema = z.object({
  correctOptionRationale: z.string().min(20),
  incorrectOptionRationales: z.array(optionRationaleSchema).min(1),
});

export const multiPassReviewResultSchema = z.object({
  pass: z.enum(['writer', 'technical', 'exam']),
  valid: z.boolean(),
  issues: z.array(z.string().min(1)),
});

export const multiPassReviewOutcomeSchema = z.object({
  passed: z.boolean(),
  results: z.array(multiPassReviewResultSchema).min(1),
});

export const noveltyScoresSchema = z.object({
  stemSimilarity: z.number().min(0).max(1),
  explanationSimilarity: z.number().min(0).max(1),
  thresholdVersion: z.string().min(1),
});

export const qualityGateDecisionSchema = z.object({
  gateId: z.enum([
    'scenario-diversity',
    'use-case-coverage',
    'style-entropy',
    'multi-pass-review',
    'distractor-quality',
    'explanation-rubric',
    'novelty',
  ]),
  result: z.enum(['pass', 'reject']),
  reasonCode: z.string().min(1),
  severity: z.enum(['info', 'warning', 'blocking']),
});

export const qualityKpiReportSchema = z.object({
  diversityIndex: z.number().min(0).max(1),
  serviceRepetitionRatio: z.number().min(0).max(1),
  styleEntropyScore: z.number().min(0).max(1),
  noveltyRejectRate: z.number().min(0).max(1),
  reviewFlag: z.boolean(),
  generatedAt: z.string().datetime(),
});

export const generatedQuestionDraftSchema = z.object({
  stem: z.string().min(50).max(2000),
  options: z.array(questionOptionSchema).min(4).max(6),
  correctAnswers: z.array(z.string().min(1)).min(1).max(3),
  domain: z.string().min(1),
  services: z.array(z.string().min(2)).min(1).max(5),
  explanation: z.string().min(50).max(3000),
  format: questionFormatSchema,
  referenceUrl: z.string().url().optional(),
  scenarioProfile: scenarioProfileSchema.optional(),
  useCaseFamily: z.string().min(1).optional(),
  styleSignature: styleSignatureSchema.optional(),
  distractorAnalysis: z.array(distractorAnalysisItemSchema).optional(),
  explanationRubric: explanationRubricSchema.optional(),
  multiPassReview: multiPassReviewOutcomeSchema.optional(),
  noveltyScores: noveltyScoresSchema.optional(),
  qualityGateDecisions: z.array(qualityGateDecisionSchema).optional(),
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
  qualityKpis: qualityKpiReportSchema.optional(),
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
  topicDistribution: z
    .record(z.string().min(1).max(64).regex(/^[a-z0-9-]+$/), z.number().int().min(1).max(100))
    .refine((dist) => Object.keys(dist).length <= 10, { message: 'Maximum 10 topic entries allowed' })
    .refine((dist) => Object.values(dist).reduce((a, b) => a + b, 0) <= 100, {
      message: 'Topic percentages exceed the allowed total of 100',
    })
    .optional(),
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
  resumedFromCheckpoint: z.boolean().optional(),
  qualityKpis: qualityKpiReportSchema.optional(),
  reviewFlag: z.boolean().optional(),
});

export const generationPlanItemSchema = z.object({
  domainId: z.string().min(1),
  format: questionFormatSchema,
  topic: z.string().min(1).optional(),
  useCaseFamily: z.string().min(1).optional(),
});

export const generationCheckpointSchema = z.object({
  certificationId: z.string().min(1),
  bankId: z.string().uuid(),
  createdAt: z.string().datetime(),
  questionCount: z.number().int().min(0),
  questions: z.array(questionSchema),
  plan: z.array(generationPlanItemSchema),
  updatedAt: z.string().datetime(),
});

export const optionAnalysisItemSchema = z.object({
  label: z.string().min(1).max(1),
  text: z.string().min(10),
  isCorrect: z.boolean(),
  explanation: z.string().min(20).max(1000),
});

export const enhancedStudyResponseSchema = z.object({
  isCorrect: z.boolean(),
  explanation: z.string().min(50).max(3000),
  detailedExplanation: z.string().min(100).max(5000),
  optionAnalysis: z.array(optionAnalysisItemSchema).min(4).max(6),
  diagram: z
    .string()
    .refine((s) => /^(graph|sequenceDiagram|flowchart|architecture)\b/.test(s.trim()), {
      message: 'Il diagramma deve iniziare con una keyword Mermaid valida',
    })
    .nullable(),
  services: z.array(z.string().min(2)).min(1),
  referenceUrl: z.string().url().optional(),
});

export type OptionAnalysisItem = z.infer<typeof optionAnalysisItemSchema>;
export type EnhancedStudyResponse = z.infer<typeof enhancedStudyResponseSchema>;
