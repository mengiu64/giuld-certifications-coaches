/**
 * Handler Lambda per l'endpoint GET /banks/{bankId}.
 *
 * Responsabilità:
 * - Recuperare una question bank tramite certificationId e bankId
 * - Se la bank ha chunks, eseguire query e riassemblarli in ordine di chunk-index
 * - Restituire 404 se la bank non viene trovata
 *
 * Input: APIGatewayProxyEvent con pathParameters.bankId e queryStringParameters.certificationId
 * Output: ApiGatewayResponse (200, 400, 404 o 500)
 */

import type { APIGatewayProxyEvent } from 'aws-lambda'; // Tipo evento API Gateway
import { getItem, queryItems } from '../utils/dynamodb-client.js'; // Operazioni DynamoDB
import { ok, badRequest, notFound, internalError } from '../utils/response.js'; // Helper risposta
import type { ApiGatewayResponse } from '../utils/response.js'; // Tipo risposta API Gateway
import { createLogger } from '../utils/logger.js'; // Factory per il logger strutturato

// Crea un'istanza del logger per questa funzione Lambda
const logger = createLogger('get-bank');

/**
 * Handler principale per GET /banks/{bankId}.
 * Recupera una question bank completa, gestendo trasparentemente
 * il riassemblaggio dei chunk per bank di grandi dimensioni.
 *
 * @param event - Evento API Gateway contenente la richiesta HTTP
 * @returns Risposta API Gateway con la bank completa o errore appropriato
 */
export async function handler(event: APIGatewayProxyEvent): Promise<ApiGatewayResponse> {
  // Imposta il requestId di correlazione dal contesto API Gateway
  logger.setRequestId(event.requestContext?.requestId ?? 'unknown');

  logger.info('Richiesta recupero question bank ricevuta');

  try {
    // Estrazione del bankId dai parametri del percorso
    const bankId = event.pathParameters?.bankId;

    if (!bankId) {
      // bankId mancante nei parametri del percorso
      logger.warn('Parametro bankId mancante nel percorso');
      return badRequest('Il parametro bankId è obbligatorio.');
    }

    // Estrazione del certificationId dai parametri della query string
    const certificationId = event.queryStringParameters?.certificationId;

    if (!certificationId) {
      // certificationId mancante nella query string
      logger.warn('Parametro certificationId mancante nella query string');
      return badRequest('Il parametro certificationId è obbligatorio.');
    }

    logger.info('Parametri di ricerca bank estratti', { bankId, certificationId });

    // Recupero del record base della bank da DynamoDB
    const bankRecord = await getItem({
      pk: `BANK#${certificationId}`,
      sk: `BANK#${bankId}`,
    });

    if (!bankRecord) {
      // Bank non trovata in DynamoDB
      logger.warn('Question bank non trovata', { bankId, certificationId });
      return notFound(`Bank ${bankId} not found.`);
    }

    // Verifica se la bank contiene domande direttamente o è suddivisa in chunk
    const chunkCount = bankRecord.chunkCount as number | undefined;

    if (!chunkCount || chunkCount <= 0) {
      // La bank contiene le domande direttamente nel record base
      logger.info('Bank recuperata senza chunk, restituzione diretta', {
        bankId,
        certificationId,
        questionCount: Array.isArray(bankRecord.questions) ? bankRecord.questions.length : 0,
      });

      // Costruzione della risposta con i dati del record base
      const response = {
        bankId: bankRecord.bankId ?? bankId,
        certificationId: bankRecord.certificationId ?? certificationId,
        certificationName: bankRecord.certificationName,
        examCode: bankRecord.examCode,
        createdAt: bankRecord.createdAt,
        questions: bankRecord.questions ?? [],
      };

      return ok(response);
    }

    // La bank è suddivisa in chunk, esecuzione query per recuperarli tutti
    logger.info('Bank con chunk rilevata, recupero chunk in corso', {
      bankId,
      certificationId,
      chunkCount,
    });

    // Query per tutti i chunk della bank usando il prefisso della partition key
    const chunks = await queryItems({
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': `BANK#${certificationId}#${bankId}`,
        ':skPrefix': 'CHUNK#',
      },
    });

    // Ordinamento dei chunk per indice numerico estratto dalla sort key
    const sortedChunks = chunks.sort((a, b) => {
      // Estrazione dell'indice numerico dalla sort key (es. "CHUNK#0" -> 0)
      const indexA = parseInt((a.sk as string).replace('CHUNK#', ''), 10);
      const indexB = parseInt((b.sk as string).replace('CHUNK#', ''), 10);
      return indexA - indexB; // Ordinamento crescente per indice
    });

    // Riassemblaggio dell'array completo delle domande concatenando i chunk ordinati
    const allQuestions: unknown[] = [];
    for (const chunk of sortedChunks) {
      // Ogni chunk contiene un array parziale di domande
      const chunkQuestions = chunk.questions as unknown[];
      if (Array.isArray(chunkQuestions)) {
        allQuestions.push(...chunkQuestions); // Concatenazione delle domande del chunk
      }
    }

    logger.info('Chunk riassemblati con successo', {
      bankId,
      certificationId,
      totalChunks: sortedChunks.length,
      totalQuestions: allQuestions.length,
    });

    // Costruzione della risposta completa con le domande riassemblate
    const response = {
      bankId: bankRecord.bankId ?? bankId,
      certificationId: bankRecord.certificationId ?? certificationId,
      certificationName: bankRecord.certificationName,
      examCode: bankRecord.examCode,
      createdAt: bankRecord.createdAt,
      questions: allQuestions,
    };

    return ok(response);
  } catch (error) {
    // Errore imprevisto durante il recupero della bank
    logger.error('Errore durante il recupero della question bank', {
      error: error instanceof Error ? error.message : String(error),
    });
    return internalError();
  }
}
