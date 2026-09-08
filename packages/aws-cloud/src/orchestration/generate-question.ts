/**
 * Lambda di orchestrazione per la generazione di una singola domanda d'esame.
 *
 * Responsabilità:
 * - Costruire il system prompt con certificazione, dominio, formato e servizi topic
 * - Invocare il modello Bedrock tramite il client condiviso
 * - Persistere il checkpoint su DynamoDB dopo generazione riuscita
 * - Aggiornare il record GENSTATUS con il progresso corrente
 *
 * Input da Step Functions (stato iteratore):
 *   { certificationId, bankId, planItem: { domainId, format, topic? }, questionIndex, executionId }
 *
 * Output:
 *   { success: true, question: { questionId, ...draft } } in caso di successo
 *   { success: false, error: string } in caso di errore
 */

import { randomUUID } from 'crypto'; // Generazione UUID per il questionId
import { invokeModel } from '../utils/bedrock-client.js'; // Client Bedrock con retry e validazione
import { loadConfig } from '../utils/ssm-config.js'; // Caricamento configurazione SSM
import { putWithRetry, checkpointKey, docClient } from '../utils/dynamodb-client.js'; // Operazioni DynamoDB
import { createLogger } from '../utils/logger.js'; // Logger strutturato
import { AI_TOPIC_SERVICES, certificationRegistry } from '@aws-exam-generator/shared'; // Costanti e registry dal pacchetto condiviso
import type { QuestionFormat } from '@aws-exam-generator/shared'; // Tipo formato domanda
import { UpdateCommand } from '@aws-sdk/lib-dynamodb'; // Comando per aggiornamento DynamoDB

// Nome tabella DynamoDB dall'ambiente
const TABLE_NAME = process.env.TABLE_NAME ?? 'aws-exam-generator';

// Ambiente di deployment (dev, staging, prod)
const ENVIRONMENT = process.env.ENVIRONMENT ?? 'dev';

// Logger per questa funzione Lambda
const logger = createLogger('generate-question');

/**
 * Mappa delle istruzioni di formato per ogni tipo di domanda.
 * Specifica il numero di opzioni e di risposte corrette attese.
 */
const FORMAT_INSTRUCTIONS: Record<QuestionFormat, string> = {
  'single-4': 'Generate a single-answer question with exactly 4 options (A-D). Exactly 1 correct answer.',
  'multi-5': 'Generate a multiple-answer question with exactly 5 options (A-E). 2-3 correct answers.',
  'multi-6': 'Generate a multiple-answer question with exactly 6 options (A-F). 2-3 correct answers.',
};

/**
 * Interfaccia per l'input ricevuto dallo stato iteratore di Step Functions.
 * Contiene tutti i dati necessari per generare una singola domanda.
 */
interface GenerateQuestionInput {
  certificationId: string; // ID della certificazione target
  bankId: string; // ID della question bank in costruzione
  planItem: {
    domainId: string; // ID del dominio per la domanda
    format: QuestionFormat; // Formato della domanda (single-4, multi-5, multi-6)
    topic?: string; // Topic opzionale (es. "generative-ai")
  };
  questionIndex: number; // Indice progressivo della domanda nel piano
  executionId: string; // ID dell'esecuzione Step Functions
}

/**
 * Costruisce il system prompt per il modello Bedrock.
 * Include certificazione, dominio, istruzioni di formato e servizi topic se applicabile.
 *
 * @param certificationId - ID della certificazione target
 * @param domainId - ID del dominio per la domanda
 * @param format - Formato della domanda
 * @param topic - Topic opzionale per vincoli aggiuntivi
 * @returns System prompt completo per il modello
 */
function buildSystemPrompt(
  certificationId: string,
  domainId: string,
  format: QuestionFormat,
  topic?: string,
): string {
  // Istruzione di formato corrispondente al tipo di domanda
  const formatInstruction = FORMAT_INSTRUCTIONS[format];

  // Recupera la configurazione della certificazione per il nome completo
  const certConfig = certificationRegistry.getById(certificationId);
  const certName = certConfig?.displayName ?? certificationId;

  // Costruisce le parti del prompt di sistema
  let prompt = `You are an expert AWS certification exam question generator.

Certification: ${certName} (${certificationId})
Domain: ${domainId}
Format: ${formatInstruction}
`;

  // Se il topic è specificato, aggiunge i servizi richiesti al prompt
  if (topic === 'generative-ai') {
    const services = AI_TOPIC_SERVICES.join(', ');
    prompt += `
Topic: Generative AI
Required services: ${services}
The question MUST reference at least one of the following AWS AI/ML services: ${services}.
`;
  }

  // Aggiunge le istruzioni per il formato di output JSON
  prompt += `
Output ONLY a valid JSON object matching this schema:
{
  "stem": "string (50-2000 chars) - The question text",
  "options": [{ "label": "A"|"B"|"C"|"D"|"E"|"F", "text": "string (min 10 chars)" }],
  "correctAnswers": ["A"|"B"|...] - Array of correct option labels,
  "domain": "string - The domain ID",
  "services": ["string"] - 1-3 AWS services referenced,
  "explanation": "string (50-3000 chars) - Why the correct answers are correct",
  "format": "${format}",
  "referenceUrl": "string (optional) - AWS documentation URL"
}

Do not include any text outside the JSON object. No markdown, no explanation before or after.`;

  return prompt;
}

/**
 * Costruisce lo user prompt per il modello Bedrock.
 * Include certificazione, dominio, formato e topic opzionale.
 *
 * @param certificationId - ID della certificazione target
 * @param domainId - ID del dominio per la domanda
 * @param format - Formato della domanda
 * @param topic - Topic opzionale
 * @returns User prompt per il modello
 */
function buildUserPrompt(
  certificationId: string,
  domainId: string,
  format: QuestionFormat,
  topic?: string,
): string {
  // Prompt base con certificazione, dominio e formato
  let prompt = `Generate an AWS certification exam question for certification ${certificationId}, domain: ${domainId}, format: ${format}.`;

  // Aggiunge vincoli di topic se specificato
  if (topic) {
    const services = topic === 'generative-ai' ? AI_TOPIC_SERVICES.join(', ') : topic;
    prompt += ` This question must focus on the topic: ${topic}. Include at least one of these services: ${services}.`;
  }

  return prompt;
}

/**
 * Persiste il checkpoint di generazione su DynamoDB.
 * Registra il progresso corrente per consentire la ripresa in caso di errore.
 *
 * @param certificationId - ID della certificazione
 * @param bankId - ID della question bank
 * @param executionId - ID dell'esecuzione Step Functions
 * @param questionIndex - Indice progressivo della domanda appena generata
 */
async function persistCheckpoint(
  certificationId: string,
  bankId: string,
  executionId: string,
  questionIndex: number,
): Promise<void> {
  // Genera le chiavi per il record checkpoint
  const key = checkpointKey(certificationId, executionId);

  // Timestamp corrente per il campo updatedAt
  const now = new Date().toISOString();

  // Scrive il checkpoint con i dati di progresso
  await putWithRetry({
    ...key,
    certificationId,
    bankId,
    questionCount: questionIndex + 1, // Numero totale di domande generate finora
    updatedAt: now,
  });
}

/**
 * Aggiorna il record GENSTATUS con il progresso della generazione.
 * Incrementa il contatore delle domande generate.
 *
 * @param certificationId - ID della certificazione
 * @param questionIndex - Indice progressivo della domanda appena generata
 */
async function updateGenStatus(
  certificationId: string,
  questionIndex: number,
): Promise<void> {
  // Timestamp corrente per il campo updatedAt
  const now = new Date().toISOString();

  // Aggiorna il record GENSTATUS con il contatore incrementato
  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        pk: `GENSTATUS#${certificationId}`,
        sk: 'GENSTATUS#latest',
      },
      UpdateExpression: 'SET generatedQuestions = :count, updatedAt = :now',
      ExpressionAttributeValues: {
        ':count': questionIndex + 1, // Numero totale di domande generate
        ':now': now, // Timestamp dell'ultimo aggiornamento
      },
    }),
  );
}

/**
 * Handler principale della Lambda di generazione domanda.
 * Riceve l'input dall'iteratore Step Functions, genera la domanda,
 * persiste il checkpoint e aggiorna il progresso.
 *
 * @param event - Input dallo stato iteratore di Step Functions
 * @returns Risultato con la domanda generata o messaggio di errore
 */
export async function handler(
  event: GenerateQuestionInput,
): Promise<{ success: boolean; question?: Record<string, unknown>; error?: string }> {
  // Estrae i parametri dall'input dell'iteratore
  const { certificationId, bankId, planItem, questionIndex, executionId } = event;
  const { domainId, format, topic } = planItem;

  logger.info('Inizio generazione domanda', {
    certificationId,
    bankId,
    domainId,
    format,
    topic: topic ?? 'nessuno',
    questionIndex,
    executionId,
  });

  try {
    // Caricamento della configurazione da SSM (con caching)
    const config = await loadConfig(ENVIRONMENT);

    // Costruzione del system prompt con certificazione, dominio, formato e topic
    const systemPrompt = buildSystemPrompt(certificationId, domainId, format, topic);

    // Costruzione dello user prompt con i dettagli della richiesta
    const userPrompt = buildUserPrompt(certificationId, domainId, format, topic);

    logger.info('Invocazione modello Bedrock in corso', {
      modelId: config.bedrockModelId,
      domainId,
      format,
    });

    // Invocazione del modello Bedrock (gestisce retry, validazione e timeout internamente)
    const generatedDraft = await invokeModel(systemPrompt, userPrompt, config);

    // Generazione di un questionId univoco per la domanda generata
    const questionId = randomUUID();

    // Persistenza del checkpoint su DynamoDB
    await persistCheckpoint(certificationId, bankId, executionId, questionIndex);

    // Aggiornamento del record GENSTATUS con il progresso
    await updateGenStatus(certificationId, questionIndex);

    logger.info('Domanda generata con successo', {
      questionId,
      certificationId,
      domainId,
      format,
      questionIndex,
    });

    // Restituisce il risultato positivo con la domanda generata
    return {
      success: true,
      question: { questionId, ...generatedDraft },
    };
  } catch (error) {
    // Errore durante la generazione, logga e restituisce il fallimento
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error('Errore durante la generazione della domanda', {
      certificationId,
      domainId,
      format,
      questionIndex,
      error: errorMessage,
    });

    // Restituisce il risultato negativo con il messaggio di errore
    return {
      success: false,
      error: errorMessage,
    };
  }
}
