/**
 * Handler Lambda per l'endpoint GET /questions.
 *
 * Responsabilità:
 * - Recuperare le domande più recenti per un dato certificationId
 * - Individuare la question bank più recente ordinando per createdAt
 * - Gestire trasparentemente il riassemblaggio dei chunk per bank di grandi dimensioni
 * - Restituire 404 se non esistono bank per la certificazione specificata
 *
 * Input: APIGatewayProxyEvent con queryStringParameters.certificationId
 * Output: ApiGatewayResponse (200, 400, 404 o 500)
 */

import type { APIGatewayProxyEvent } from 'aws-lambda'; // Tipo evento API Gateway
import { queryItems } from '../utils/dynamodb-client.js'; // Operazione query DynamoDB
import { ok, badRequest, notFound, internalError } from '../utils/response.js'; // Helper risposta
import type { ApiGatewayResponse } from '../utils/response.js'; // Tipo risposta API Gateway
import { createLogger } from '../utils/logger.js'; // Factory per il logger strutturato

// Crea un'istanza del logger per questa funzione Lambda
const logger = createLogger('get-questions');

/**
 * Handler principale per GET /questions.
 * Recupera le domande dalla question bank più recente
 * per la certificazione specificata tramite query string.
 *
 * @param event - Evento API Gateway contenente la richiesta HTTP
 * @returns Risposta API Gateway con le domande o errore appropriato
 */
export async function handler(event: APIGatewayProxyEvent): Promise<ApiGatewayResponse> {
  // Imposta il requestId di correlazione dal contesto API Gateway
  logger.setRequestId(event.requestContext?.requestId ?? 'unknown');

  logger.info('Richiesta recupero domande recenti ricevuta'); // Log inizio elaborazione

  try {
    // Estrazione del certificationId dai parametri della query string
    const certificationId = event.queryStringParameters?.certificationId;

    if (!certificationId) {
      // certificationId mancante nella query string
      logger.warn('Parametro certificationId mancante nella query string');
      return badRequest('Il parametro certificationId è obbligatorio.');
    }

    logger.info('Ricerca question bank per certificazione', { certificationId }); // Log parametro ricevuto

    // Query per tutte le bank della certificazione specificata
    const banks = await queryItems({
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :skPrefix)', // Condizione chiave per bank
      ExpressionAttributeValues: {
        ':pk': `BANK#${certificationId}`, // Partition key per la certificazione
        ':skPrefix': 'BANK#', // Prefisso sort key per filtrare solo record bank
      },
    });

    if (banks.length === 0) {
      // Nessuna bank trovata per la certificazione specificata
      logger.warn('Nessuna question bank trovata per la certificazione', { certificationId });
      return notFound(`Nessuna question bank trovata per la certificazione ${certificationId}.`);
    }

    // Ordinamento delle bank per createdAt in ordine decrescente per ottenere la più recente
    const sortedBanks = banks.sort((a, b) => {
      const dateA = a.createdAt as string ?? ''; // Data di creazione della bank A
      const dateB = b.createdAt as string ?? ''; // Data di creazione della bank B
      return dateB.localeCompare(dateA); // Ordinamento decrescente (più recente prima)
    });

    // Selezione della bank più recente (primo elemento dopo l'ordinamento)
    const latestBank = sortedBanks[0]!;

    logger.info('Bank più recente individuata', {
      bankId: latestBank.bankId, // ID della bank più recente
      certificationId, // ID della certificazione
      createdAt: latestBank.createdAt, // Data di creazione della bank
    });

    // Verifica se la bank contiene domande direttamente o è suddivisa in chunk
    const chunkCount = latestBank.chunkCount as number | undefined;

    if (!chunkCount || chunkCount <= 0) {
      // La bank contiene le domande direttamente nel record base
      const questions = (latestBank.questions as unknown[]) ?? []; // Estrazione array domande

      logger.info('Domande recuperate direttamente dalla bank', {
        certificationId, // ID della certificazione
        questionCount: questions.length, // Numero di domande trovate
      });

      return ok(questions); // Restituzione dell'array di domande
    }

    // La bank è suddivisa in chunk, recupero di tutti i chunk
    const bankId = latestBank.bankId as string; // ID della bank per la query chunk

    logger.info('Bank con chunk rilevata, recupero chunk in corso', {
      bankId, // ID della bank
      certificationId, // ID della certificazione
      chunkCount, // Numero totale di chunk
    });

    // Query per tutti i chunk della bank usando il prefisso della partition key
    const chunks = await queryItems({
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :skPrefix)', // Condizione chiave per chunk
      ExpressionAttributeValues: {
        ':pk': `BANK#${certificationId}#${bankId}`, // Partition key per i chunk della bank
        ':skPrefix': 'CHUNK#', // Prefisso sort key per filtrare solo record chunk
      },
    });

    // Ordinamento dei chunk per indice numerico estratto dalla sort key
    const sortedChunks = chunks.sort((a, b) => {
      const indexA = parseInt((a.sk as string).replace('CHUNK#', ''), 10); // Indice del chunk A
      const indexB = parseInt((b.sk as string).replace('CHUNK#', ''), 10); // Indice del chunk B
      return indexA - indexB; // Ordinamento crescente per indice
    });

    // Riassemblaggio dell'array completo delle domande concatenando i chunk ordinati
    const allQuestions: unknown[] = [];
    for (const chunk of sortedChunks) {
      const chunkQuestions = chunk.questions as unknown[]; // Domande parziali del chunk
      if (Array.isArray(chunkQuestions)) {
        allQuestions.push(...chunkQuestions); // Concatenazione delle domande del chunk
      }
    }

    logger.info('Chunk riassemblati con successo, domande restituite', {
      certificationId, // ID della certificazione
      bankId, // ID della bank
      totalChunks: sortedChunks.length, // Numero di chunk recuperati
      totalQuestions: allQuestions.length, // Numero totale di domande riassemblate
    });

    return ok(allQuestions); // Restituzione dell'array completo di domande riassemblate
  } catch (error) {
    // Errore imprevisto durante il recupero delle domande
    logger.error('Errore durante il recupero delle domande', {
      error: error instanceof Error ? error.message : String(error), // Dettagli dell'errore
    });
    return internalError(); // Risposta 500 per errore interno
  }
}
