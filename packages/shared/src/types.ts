export type QuestionFormat = 'single-4' | 'multi-5' | 'multi-6';
export type QuestionLabel = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
export type CertificationLevel = 'professional' | 'associate' | 'specialty';
export type ExamMode = 'exam' | 'study';
export type ExamSessionStatus = 'in_progress' | 'submitted' | 'paused';
export type GenerationState = 'idle' | 'running' | 'completed' | 'failed';

export interface QuestionOption {
  label: QuestionLabel;
  text: string;
}

export interface ScenarioProfile {
  industry: string;
  organizationSize: 'startup' | 'mid-market' | 'enterprise';
  geographyCompliance: string;
  migrationMaturity: 'greenfield' | 'brownfield' | 'hybrid';
  businessObjective: string;
}

export interface StyleSignature {
  openingPattern: string;
  decisionIntent: string;
  rhetoricalShape: string;
}

export interface DistractorAnalysisItem {
  label: QuestionLabel;
  misconceptionClass: string;
  reason: string;
}

export interface OptionRationale {
  label: QuestionLabel;
  rationale: string;
}

export interface ExplanationRubric {
  correctOptionRationale: string;
  incorrectOptionRationales: OptionRationale[];
}

export interface MultiPassReviewResult {
  pass: 'writer' | 'technical' | 'exam';
  valid: boolean;
  issues: string[];
}

export interface MultiPassReviewOutcome {
  passed: boolean;
  results: MultiPassReviewResult[];
}

export interface NoveltyScores {
  stemSimilarity: number;
  explanationSimilarity: number;
  thresholdVersion: string;
}

export interface QualityGateDecision {
  gateId:
    | 'scenario-diversity'
    | 'use-case-coverage'
    | 'style-entropy'
    | 'multi-pass-review'
    | 'distractor-quality'
    | 'explanation-rubric'
    | 'novelty';
  result: 'pass' | 'reject';
  reasonCode: string;
  severity: 'info' | 'warning' | 'blocking';
}

export interface QualityKpiReport {
  diversityIndex: number;
  serviceRepetitionRatio: number;
  styleEntropyScore: number;
  noveltyRejectRate: number;
  reviewFlag: boolean;
  generatedAt: string;
}

export interface Question {
  questionId: string;
  stem: string;
  options: QuestionOption[];
  correctAnswers: string[];
  domain: string;
  services: string[];
  explanation: string;
  format: QuestionFormat;
  referenceUrl?: string | undefined;
  scenarioProfile?: ScenarioProfile | undefined;
  useCaseFamily?: string | undefined;
  styleSignature?: StyleSignature | undefined;
  distractorAnalysis?: DistractorAnalysisItem[] | undefined;
  explanationRubric?: ExplanationRubric | undefined;
  multiPassReview?: MultiPassReviewOutcome | undefined;
  noveltyScores?: NoveltyScores | undefined;
  qualityGateDecisions?: QualityGateDecision[] | undefined;
}

export type GeneratedQuestionDraft = Omit<Question, 'questionId'>;

export interface QuestionBank {
  bankId: string;
  certificationId: string;
  certificationName: string;
  examCode: string;
  createdAt: string;
  questions: Question[];
  qualityKpis?: QualityKpiReport | undefined;
}

export interface QuestionBankSummary {
  bankId: string;
  certificationId: string;
  certificationName: string;
  examCode: string;
  createdAt: string;
  questionCount: number;
}

export interface StudyQuestionResult {
  questionIndex: number;
  selectedAnswers: string[];
  isCorrect: boolean;
  answeredAt: string;
}

export interface ExamSession {
  sessionId: string;
  bankId: string;
  certificationId: string;
  mode: ExamMode;
  status: ExamSessionStatus;
  startedAt: string;
  timeRemainingMs: number;
  questionOrder: number[];
  answers: [number, string[]][];
  markedForReview: number[];
  studyResults?: StudyQuestionResult[] | undefined;
}

export interface ExamResult {
  sessionId: string;
  bankId: string;
  completedAt: string;
  score: number;
  passed: boolean;
  totalQuestions: number;
  correctCount: number;
  domainBreakdown: Record<string, { correct: number; total: number }>;
}

export interface CertificationDomain {
  id: string;
  name: string;
  percentage: number;
}

export interface CertificationConfig {
  id: string;
  displayName: string;
  examCode: string;
  level: CertificationLevel;
  domains: CertificationDomain[];
  formatDistribution: {
    singleAnswer4Options: number;
    multiAnswer5Options: number;
    multiAnswer6Options: number;
  };
  totalQuestions: number;
  timeLimitMinutes: number;
  /**
   * Distribuzione opzionale dei topic per la certificazione.
   * Mappa ogni identificatore di topic alla percentuale di domande da riservare.
   * Es. { "generative-ai": 34 } riserva il 34% delle domande al topic AI generativa.
   */
  topicDistribution?: Record<string, number>;
}

export interface CertificationRegistry {
  getAll(): Record<CertificationLevel, CertificationConfig[]>;
  getById(id: string): CertificationConfig | null;
  getByLevel(level: CertificationLevel): CertificationConfig[];
}

export interface DocumentationResult {
  title: string;
  url: string;
  snippet: string;
  service: string;
  domain: string;
  source: 'aws-docs-mock';
}

export interface GenerationStatus {
  state: GenerationState;
  certificationId?: string | undefined;
  bankId?: string | undefined;
  generatedQuestions: number;
  targetQuestions: number;
  startedAt?: string | undefined;
  updatedAt: string;
  lastError?: string | undefined;
  message: string;
  checkpointPath?: string | undefined;
  resumedFromCheckpoint?: boolean | undefined;
  qualityKpis?: QualityKpiReport | undefined;
  reviewFlag?: boolean | undefined;
}

export interface GenerationPlanItem {
  domainId: string;
  format: QuestionFormat;
  /**
   * Topic opzionale assegnato a questo elemento del piano di generazione.
   * Se presente, la domanda generata dovrà rispettare i vincoli del topic indicato
   * (es. "generative-ai" richiede riferimenti a servizi AWS di AI generativa).
   */
  topic?: string | undefined;
  useCaseFamily?: string | undefined;
}

export interface GenerationCheckpoint {
  certificationId: string;
  bankId: string;
  createdAt: string;
  questionCount: number;
  questions: Question[];
  plan: GenerationPlanItem[];
  updatedAt: string;
}
