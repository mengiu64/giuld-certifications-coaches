/**
 * Handler Lambda per l'endpoint POST /questions.
 *
 * Responsabilità:
 * - Validare la domanda ricevuta contro il generatedQuestionDraftSchema
 * - Generare un questionId univoco per la domanda
 * - Scrivere la domanda in DynamoDB sotto il record della bank
 * - Restituire 201 Created con i dati della domanda salvata
 *
 * Input: APIGatewayProxyEvent con body JSON contenente certificationId, bankId, question
 * Output: ApiGatewayResponse (201, 400 o 500)
 */

import crypto from 'node:crypto'; // Modulo nativo per la generazione di UUID
import type { APIGatewayProxyEvent } from 'aws-lambda'; // Tipo evento API Gateway
import { generatedQuestionDraftSchema } from '@aws-exam-generator/shared'; // Schema di validazione domanda
import { putWithRetry } from '../utils/dynamodb-client.js'; // Operazione scrittura DynamoDB con retry
import { created, badRequest, internalError } from '../utils/response.js'; // Helper risposta
import type { ApiGatewayResponse } from '../utils/response.js'; // Tipo risposta API Gateway
import { createLogger } from '../utils/logger.js'; // Factory per il logger strutturato

// Crea un'istanza del logger per questa funzione Lambda
const logger = createLogger('save-question');

/**
 * Handler principale per POST /questions.
 * Valida la domanda, genera un ID univoco e la persiste in DynamoDB.
 *
 * @param event - Evento API Gateway contenente la richiesta HTTP
 * @returns Risposta API Gateway con la domanda salvata o errore appropriato
 */
export async function handler(event: APIGatewayProxyEvent): Promise<ApiGatewayResponse> {
  // Imposta il requestId di correlazione dal contesto API Gateway
  logger.setRequestId(event.requestContext?.requestId ?? 'unknown');

  logger.info('Richiesta salvataggio domanda ricevuta');

  try {
    // Parsing del corpo della richiesta JSON
    if (!event.body) {
      // Corpo della richiesta mancante
      logger.warn('Corpo della richiesta mancante');
      return badRequest('Il corpo della richiesta è obbligatorio.');
    }

    let parsedBody: unknown;
    try {
      // Tentativo di deserializzazione del corpo JSON
      parsedBody = JSON.parse(event.body);
    } catch {
      // Corpo della richiesta non è un JSON valido
      logger.warn('Corpo della richiesta non è un JSON valido');
      return badRequest('Il corpo della richiesta deve essere un JSON valido.');
    }

    // Verifica che il corpo sia un oggetto con i campi obbligatori
    const body = parsedBody as Record<string, unknown>;

    const certificationId = body.certificationId as string | undefined;
    const bankId = body.bankId as string | undefined;
    const question = body.question;

    // Validazione dei campi obbligatori nel corpo della richiesta
    if (!certificationId || typeof certificationId !== 'string') {
      logger.warn('Campo certificationId mancante o non valido');
      return badRequest('Il campo certificationId è obbligatorio e deve essere una stringa.');
    }

    if (!bankId || typeof bankId !== 'string') {
      logger.warn('Campo bankId mancante o non valido');
      return badRequest('Il campo bankId è obbligatorio e deve essere una stringa.');
    }

    if (!question) {
      logger.warn('Campo question mancante nel corpo della richiesta');
      return badRequest('Il campo question è obbligatorio.');
    }

    // Validazione della domanda contro lo schema generatedQuestionDraftSchema
    const validationResult = generatedQuestionDraftSchema.safeParse(question);

    if (!validationResult.success) {
      // La domanda non supera la validazione dello schema
      const errorMessages = validationResult.error.errors
        .map((e) => `${e.path.join('.')}: ${e.message}`)
        .join('; ');

      logger.warn('Validazione domanda fallita', { errors: errorMessages });
      return badRequest(`Validazione domanda fallita: ${errorMessages}`);
    }

    // Generazione di un identificatore univoco per la domanda
    const questionId = crypto.randomUUID();

    // Costruzione dell'elemento da persistere in DynamoDB
    const item = {
      pk: `BANK#${certificationId}`, // Chiave di partizione basata sulla certificazione
      sk: `QUESTION#${questionId}`, // Chiave di ordinamento con ID univoco della domanda
      questionId, // Identificatore univoco della domanda
      certificationId, // Identificatore della certificazione associata
      bankId, // Identificatore della bank di appartenenza
      ...validationResult.data, // Dati della domanda validati dallo schema
      createdAt: new Date().toISOString(), // Timestamp di creazione in formato ISO 8601
    };

    // Scrittura dell'elemento in DynamoDB con retry esponenziale
    await putWithRetry(item);

    logger.info('Domanda salvata con successo in DynamoDB', {
      questionId,
      certificationId,
      bankId,
    });

    // Restituzione della risposta 201 Created con i dati della domanda salvata
    return created({
      questionId,
      certificationId,
      bankId,
      ...validationResult.data,
      createdAt: item.createdAt,
    });
  } catch (error) {
    // Errore imprevisto durante il salvataggio della domanda
    logger.error('Errore durante il salvataggio della domanda', {
      error: error instanceof Error ? error.message : String(error),
    });
    return internalError();
  }
}
