/**
 * Handler Lambda per l'endpoint GET /exams/generate/status.
 *
 * Interroga DynamoDB per recuperare il record GENSTATUS relativo
 * alla certificazione specificata e restituisce lo stato corrente
 * della generazione, incluso il progresso (domande generate/target).
 *
 * Input: APIGatewayProxyEvent con query string parameter `certificationId`
 * Output: ApiGatewayResponse 200 con lo stato corrente della generazione,
 *         oppure 400 se il parametro certificationId è mancante
 */

import type { APIGatewayProxyEvent } from 'aws-lambda'; // Tipo evento API Gateway
import { getItem } from '../utils/dynamodb-client.js'; // Funzione per leggere da DynamoDB
import { ok, badRequest, internalError } from '../utils/response.js'; // Helper risposte HTTP
import type { ApiGatewayResponse } from '../utils/response.js'; // Tipo risposta API Gateway
import { createLogger } from '../utils/logger.js'; // Factory per il logger strutturato

// Crea un'istanza del logger per questa funzione Lambda
const logger = createLogger('get-generation-status');

/**
 * Handler principale per GET /exams/generate/status.
 * Recupera il record GENSTATUS per la certificazione specificata
 * e restituisce lo stato corrente della generazione con il progresso.
 *
 * @param event - Evento API Gateway contenente la richiesta HTTP
 * @returns Risposta 200 con lo stato della generazione, oppure 400 se manca certificationId
 */
export async function handler(event: APIGatewayProxyEvent): Promise<ApiGatewayResponse> {
  // Imposta il requestId di correlazione dal contesto API Gateway
  logger.setRequestId(event.requestContext?.requestId ?? 'unknown');

  // Estrae il parametro certificationId dalla query string
  const certificationId = event.queryStringParameters?.certificationId;

  // Verifica che il parametro certificationId sia presente nella richiesta
  if (!certificationId) {
    // Log dell'avviso per parametro mancante
    logger.warn('Richiesta ricevuta senza parametro certificationId');
    // Restituisce errore 400 con messaggio descrittivo
    return badRequest('Il parametro certificationId è obbligatorio');
  }

  // Log dell'operazione di lettura in corso
  logger.info('Recupero stato generazione per certificazione', { certificationId });

  try {
    // Costruisce le chiavi primarie per il record GENSTATUS
    const key = {
      pk: `GENSTATUS#${certificationId}`, // Partition key con prefisso entità
      sk: 'GENSTATUS#latest', // Sort key per l'ultimo stato disponibile
    };

    // Legge il record GENSTATUS da DynamoDB
    const item = await getItem(key);

    // Se il record non esiste, restituisce lo stato predefinito "idle"
    if (!item) {
      // Log informativo: nessuna generazione in corso per questa certificazione
      logger.info('Nessun record GENSTATUS trovato, restituzione stato idle', { certificationId });

      // Restituisce lo stato predefinito senza generazione attiva
      return ok({
        state: 'idle', // Stato di inattività
        generatedQuestions: 0, // Nessuna domanda generata
        targetQuestions: 0, // Nessun obiettivo impostato
        message: 'No generation in progress.', // Messaggio informativo
        updatedAt: new Date().toISOString(), // Timestamp corrente
      });
    }

    // Log del record GENSTATUS recuperato con successo
    logger.info('Record GENSTATUS recuperato con successo', {
      certificationId, // Certificazione interrogata
      state: item.state as string, // Stato corrente della generazione
      generatedQuestions: item.generatedQuestions as number, // Domande generate finora
      targetQuestions: item.targetQuestions as number, // Obiettivo totale di domande
    });

    // Restituisce i campi dello stato memorizzato nel record GENSTATUS
    return ok({
      state: item.state, // Stato corrente (RUNNING, COMPLETED, FAILED)
      certificationId: item.certificationId, // Identificativo della certificazione
      bankId: item.bankId, // Identificativo della bank in generazione
      generatedQuestions: item.generatedQuestions, // Numero di domande generate
      targetQuestions: item.targetQuestions, // Numero totale di domande obiettivo
      startedAt: item.startedAt, // Timestamp di inizio generazione
      updatedAt: item.updatedAt, // Timestamp dell'ultimo aggiornamento
      message: item.message, // Messaggio descrittivo dello stato
    });
  } catch (error) {
    // Log dell'errore durante la lettura da DynamoDB
    logger.error('Errore durante il recupero dello stato di generazione', {
      certificationId, // Certificazione che ha causato l'errore
      error: error instanceof Error ? error.message : String(error), // Messaggio di errore
    });

    // Restituisce errore 500 per problemi interni del server
    return internalError();
  }
}
