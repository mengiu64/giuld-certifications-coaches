import type { QuestionFormat, QuestionLabel } from './types.js';

export const DEFAULT_CERTIFICATION_ID = 'SAP-C02';
export const QUESTION_LABELS: QuestionLabel[] = ['A', 'B', 'C', 'D', 'E', 'F'];
export const FORMAT_OPTION_COUNT: Record<QuestionFormat, number> = {
  'single-4': 4,
  'multi-5': 5,
  'multi-6': 6,
};
export const GENERATION_CHECKPOINT_INTERVAL = 5;
export const MCP_RETRY_ATTEMPTS = 3;
export const MCP_RETRY_INTERVAL_MS = 5000;
export const BEDROCK_RETRY_DELAYS_MS = [1000, 2000, 4000] as const;
export const BEDROCK_INTER_REQUEST_DELAY_MS = 2000;
export const DEFAULT_API_PORT = 4000;
export const DEFAULT_FRONTEND_PORT = 5173;
export const QUESTION_BANKS_DIR = 'data/question-banks';
export const CHECKPOINT_FILE_NAME = 'generation-checkpoint.json';
export const LOCAL_STORAGE_KEYS = {
  sessionIndex: 'session_index',
  selectedCertification: 'selected_certification',
  examSessionPrefix: 'exam_session_',
  examResultPrefix: 'exam_result_',
} as const;
export const EXAM_STATE_MACHINE = ['IDLE', 'GENERATING', 'READY', 'IN_PROGRESS', 'SUBMITTED', 'RESULTS'] as const;

/**
 * Percentuale di default per il topic AI generativa nelle certificazioni.
 * Utilizzata come fallback quando il file YAML non specifica un valore.
 */
export const DEFAULT_AI_TOPIC_PERCENTAGE = 34;

/**
 * Elenco dei servizi AWS classificati come AI/Generative AI.
 * Utilizzato per validazione, prompt e costruzione mock delle domande a tema AI.
 */
export const AI_TOPIC_SERVICES: readonly string[] = [
  'Amazon Bedrock',
  'Amazon Q',
  'PartyRock',
  'SageMaker JumpStart',
  'Amazon CodeWhisperer',
  'Amazon Titan',
] as const;
