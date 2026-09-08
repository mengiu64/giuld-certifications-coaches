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
  /**
   * Distribuzione opzionale dei topic per la certificazione.
   * Mappa ogni identificatore di topic (chiave: 1-64 caratteri, pattern [a-z0-9-]+)
   * alla percentuale intera (1-100) di domande da riservare.
   * Vincoli: massimo 10 entry, somma dei valori ≤ 100.
   */
  topicDistribution: z.record(
    z.string().min(1).max(64).regex(/^[a-z0-9-]+$/),
    z.number().int().min(1).max(100)
  ).refine(
    (dist) => Object.keys(dist).length <= 10,
    { message: 'Maximum 10 topic entries allowed' }
  ).refine(
    (dist) => Object.values(dist).reduce((a, b) => a + b, 0) <= 100,
    { message: 'Topic percentages exceed the allowed total of 100' }
  ).optional(),
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
});

export const generationPlanItemSchema = z.object({
  domainId: z.string().min(1),
  format: questionFormatSchema,
  /**
   * Topic opzionale assegnato all'elemento del piano.
   * Se presente, indica che la domanda generata deve rispettare i vincoli del topic
   * (es. "generative-ai" richiede servizi AWS di AI generativa).
   */
  topic: z.string().min(1).optional(),
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

/**
 * Schema di validazione per l'analisi di una singola opzione di risposta.
 * Utilizzato all'interno dell'Enhanced Study Response per descrivere
 * perché ciascuna opzione è corretta o incorretta.
 */
export const optionAnalysisItemSchema = z.object({
  /** Etichetta dell'opzione (A, B, C, D, E, F) — singolo carattere */
  label: z.string().min(1).max(1),
  /** Testo completo dell'opzione di risposta */
  text: z.string().min(10),
  /** Indica se questa opzione è una risposta corretta */
  isCorrect: z.boolean(),
  /** Spiegazione del perché l'opzione è corretta o incorretta (20-1000 caratteri) */
  explanation: z.string().min(20).max(1000),
});

/**
 * Schema di validazione per la risposta arricchita in modalità studio.
 * Valida tutti i campi dell'Enhanced Study Response restituita al client
 * dopo la verifica di una risposta in study mode.
 */
export const enhancedStudyResponseSchema = z.object({
  /** Indica se la risposta dell'utente è corretta */
  isCorrect: z.boolean(),
  /** Spiegazione base della risposta (50-3000 caratteri) */
  explanation: z.string().min(50).max(3000),
  /** Spiegazione dettagliata generata da Bedrock (100-5000 caratteri) */
  detailedExplanation: z.string().min(100).max(5000),
  /** Analisi dettagliata per ciascuna opzione della domanda (4-6 elementi) */
  optionAnalysis: z.array(optionAnalysisItemSchema).min(4).max(6),
  /**
   * Diagramma Mermaid opzionale (null se non applicabile o generazione fallita).
   * Deve iniziare con una keyword Mermaid valida: graph, sequenceDiagram, flowchart, architecture.
   */
  diagram: z.string()
    .refine(
      (s) => /^(graph|sequenceDiagram|flowchart|architecture)\b/.test(s.trim()),
      { message: 'Il diagramma deve iniziare con una keyword Mermaid valida' }
    )
    .nullable(),
  /** Array dei servizi AWS coinvolti nella domanda (minimo 1 elemento) */
  services: z.array(z.string().min(2)).min(1),
  /** URL di riferimento alla documentazione AWS (opzionale) */
  referenceUrl: z.string().url().optional(),
});

/** Tipo TypeScript inferito dallo schema di analisi di una singola opzione */
export type OptionAnalysisItem = z.infer<typeof optionAnalysisItemSchema>;

/** Tipo TypeScript inferito dallo schema della risposta arricchita in modalità studio */
export type EnhancedStudyResponse = z.infer<typeof enhancedStudyResponseSchema>;
