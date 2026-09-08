/**
 * Handler Lambda per l'endpoint GET /banks.
 *
 * Interroga DynamoDB per recuperare tutte le question bank associate
 * a un determinato certificationId e restituisce un array di sommari.
 * Ogni sommario contiene: bankId, certificationId, certificationName,
 * examCode, createdAt e questionCount.
 *
 * Input: APIGatewayProxyEvent con query string parameter `certificationId`
 * Output: ApiGatewayResponse 200 con array di QuestionBankSummary,
 *         oppure 400 se il parametro certificationId è mancante
 */

import type { APIGatewayProxyEvent } from 'aws-lambda'; // Tipo evento API Gateway
import { queryItems } from '../utils/dynamodb-client.js'; // Funzione per interrogare DynamoDB
import { ok, badRequest, internalError } from '../utils/response.js'; // Helper risposte HTTP
import type { ApiGatewayResponse } from '../utils/response.js'; // Tipo risposta API Gateway
import { createLogger } from '../utils/logger.js'; // Factory per il logger strutturato

// Crea un'istanza del logger per questa funzione Lambda
const logger = createLogger('list-banks');

/**
 * Interfaccia per il sommario di una question bank.
 * Rappresenta i dati essenziali restituiti nell'elenco delle bank.
 */
interface QuestionBankSummary {
  bankId: string; // Identificativo univoco della bank
  certificationId: string; // Identificativo della certificazione associata
  certificationName: string; // Nome della certificazione
  examCode: string; // Codice dell'esame
  createdAt: string; // Data di creazione in formato ISO 8601
  questionCount: number; // Numero totale di domande nella bank
}

/**
 * Handler principale per GET /banks.
 * Recupera tutte le question bank per una data certificazione da DynamoDB
 * e restituisce un array di sommari con i campi essenziali.
 *
 * @param event - Evento API Gateway contenente la richiesta HTTP
 * @returns Risposta 200 con array di sommari, oppure 400 se manca certificationId
 */
export async function handler(event: APIGatewayProxyEvent): Promise<ApiGatewayResponse> {
  // Imposta il requestId di correlazione dal contesto API Gateway
  logger.setRequestId(event.requestContext?.requestId ?? 'unknown');

  // Estrae il parametro certificationId dalla query string
  const certificationId = event.queryStringParameters?.certificationId;

  // Verifica che il parametro certificationId sia presente nella richiesta
  if (!certificationId) {
    // Log dell'errore per parametro mancante
    logger.warn('Richiesta ricevuta senza parametro certificationId');
    // Restituisce errore 400 con messaggio descrittivo
    return badRequest('Il parametro certificationId è obbligatorio');
  }

  // Log dell'operazione di query in corso
  logger.info('Recupero elenco question bank per certificazione', { certificationId });

  try {
    // Costruisce il prefisso della partition key per la certificazione
    const pkValue = `BANK#${certificationId}`;
    // Prefisso della sort key per filtrare solo i record di tipo bank
    const skPrefix = 'BANK#';

    // Esegue la query su DynamoDB con KeyConditionExpression
    const items = await queryItems({
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :skPrefix)', // Condizione sulle chiavi
      ExpressionAttributeValues: {
        ':pk': pkValue, // Valore della partition key per la certificazione
        ':skPrefix': skPrefix, // Prefisso della sort key per i record bank
      },
    });

    // Trasforma i record DynamoDB in sommari QuestionBankSummary
    const summaries: QuestionBankSummary[] = items.map((item) => ({
      bankId: item.bankId as string, // Identificativo univoco della bank
      certificationId: item.certificationId as string, // Identificativo della certificazione
      certificationName: item.certificationName as string, // Nome della certificazione
      examCode: item.examCode as string, // Codice dell'esame
      createdAt: item.createdAt as string, // Data di creazione
      questionCount: typeof item.questionCount === 'number' // Numero di domande
        ? item.questionCount // Usa il campo questionCount se è un numero
        : Array.isArray(item.questions) // Altrimenti verifica se esiste l'array questions
          ? item.questions.length // Calcola il conteggio dall'array questions
          : 0, // Default a zero se nessuna informazione disponibile
    }));

    // Log del numero di bank trovate per la certificazione
    logger.info('Elenco question bank recuperato con successo', {
      certificationId, // Certificazione interrogata
      bankCount: summaries.length, // Numero di bank trovate
    });

    // Restituisce la risposta 200 OK con l'array dei sommari
    return ok(summaries);
  } catch (error) {
    // Log dell'errore durante la query DynamoDB
    logger.error('Errore durante il recupero delle question bank', {
      certificationId, // Certificazione che ha causato l'errore
      error: error instanceof Error ? error.message : String(error), // Messaggio di errore
    });

    // Restituisce errore 500 per problemi interni del server
    return internalError();
  }
}
