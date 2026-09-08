/**
 * Handler Lambda per avviare la generazione di domande per una certificazione.
 *
 * Responsabilità:
 * - Validare il certificationId contro il registry delle certificazioni
 * - Verificare che non ci sia già un'esecuzione in corso per la stessa certificazione
 * - Avviare l'esecuzione della Step Functions state machine
 * - Scrivere il record GENSTATUS iniziale con stato "RUNNING"
 * - Restituire 202 Accepted con executionId e bankId
 *
 * Input: APIGatewayProxyEvent con body JSON contenente certificationId
 * Output: ApiGatewayResponse (202, 400, 409 o 500)
 */

import { randomUUID } from 'crypto'; // Generazione UUID per il bankId
import type { APIGatewayProxyEvent } from 'aws-lambda'; // Tipo evento API Gateway
import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn'; // Client Step Functions
import { certificationRegistry } from '@aws-exam-generator/shared'; // Registry delle certificazioni
import { getItem, putWithRetry } from '../utils/dynamodb-client.js'; // Operazioni DynamoDB
import { accepted, badRequest, conflict, internalError } from '../utils/response.js'; // Helper risposta
import { createLogger } from '../utils/logger.js'; // Logger strutturato
import type { ApiGatewayResponse } from '../utils/response.js'; // Tipo risposta

// ARN della state machine Step Functions dall'ambiente
const STATE_MACHINE_ARN = process.env.STATE_MACHINE_ARN ?? '';

// Client Step Functions singleton
const sfnClient = new SFNClient({});

// Logger per questa funzione Lambda
const logger = createLogger('start-generation');

/**
 * Handler principale per l'endpoint POST /exams/generate.
 * Avvia il processo di generazione domande per la certificazione specificata.
 *
 * @param event - Evento API Gateway con body JSON contenente certificationId
 * @returns Risposta API Gateway con codice appropriato
 */
export async function handler(event: APIGatewayProxyEvent): Promise<ApiGatewayResponse> {
  // Imposta il requestId per la correlazione dei log
  const requestId = event.requestContext?.requestId ?? 'unknown';
  logger.setRequestId(requestId);

  logger.info('Richiesta di avvio generazione ricevuta');

  try {
    // Parsing del body della richiesta
    const body = parseBody(event.body);

    if (!body || !body.certificationId) {
      // Body mancante o certificationId assente
      logger.warn('Body della richiesta mancante o certificationId assente');
      return badRequest('Il campo certificationId è obbligatorio.');
    }

    const { certificationId } = body;

    // Validazione del certificationId contro il registry
    const certConfig = certificationRegistry.getById(certificationId);
    if (!certConfig) {
      // Certificazione sconosciuta, risposta 400
      logger.warn('Certificazione sconosciuta richiesta', { certificationId });
      return badRequest(`Unknown certification: ${certificationId}`);
    }

    // Verifica se esiste già un'esecuzione in corso per questa certificazione
    const existingStatus = await getItem({
      pk: `GENSTATUS#${certificationId}`,
      sk: 'GENSTATUS#latest',
    });

    if (existingStatus && existingStatus.state === 'RUNNING') {
      // Esecuzione già in corso, risposta 409 Conflict
      logger.warn('Generazione già in corso per questa certificazione', { certificationId });
      return conflict('A generation job is already running.');
    }

    // Generazione del bankId univoco per questa esecuzione
    const bankId = randomUUID();

    // Avvio dell'esecuzione della state machine Step Functions
    const executionResult = await sfnClient.send(
      new StartExecutionCommand({
        stateMachineArn: STATE_MACHINE_ARN,
        input: JSON.stringify({
          certificationId,
          bankId,
        }),
      })
    );

    // Estrazione dell'executionId dall'ARN dell'esecuzione
    const executionArn = executionResult.executionArn ?? '';
    const executionId = executionArn.split(':').pop() ?? bankId;

    // Timestamp corrente per i campi temporali
    const now = new Date().toISOString();

    // Scrittura del record GENSTATUS iniziale con stato RUNNING
    await putWithRetry({
      pk: `GENSTATUS#${certificationId}`,
      sk: 'GENSTATUS#latest',
      state: 'RUNNING',
      certificationId,
      bankId,
      generatedQuestions: 0,
      targetQuestions: certConfig.totalQuestions,
      startedAt: now,
      updatedAt: now,
      message: `Generazione avviata per ${certConfig.displayName}`,
    });

    logger.info('Generazione avviata con successo', {
      certificationId,
      bankId,
      executionId,
      targetQuestions: certConfig.totalQuestions,
    });

    // Risposta 202 Accepted con executionId e bankId
    return accepted({ executionId, bankId });
  } catch (error) {
    // Errore imprevisto durante l'elaborazione
    logger.error('Errore durante avvio generazione', {
      error: error instanceof Error ? error.message : String(error),
    });
    return internalError();
  }
}

/**
 * Effettua il parsing sicuro del body JSON della richiesta.
 * Restituisce null se il body è assente o malformato.
 *
 * @param body - Body della richiesta come stringa JSON o null
 * @returns Oggetto parsato o null in caso di errore
 */
function parseBody(body: string | null): { certificationId?: string } | null {
  if (!body) {
    // Body assente nella richiesta
    return null;
  }

  try {
    // Tentativo di parsing JSON del body
    return JSON.parse(body) as { certificationId?: string };
  } catch {
    // Body malformato, non è JSON valido
    return null;
  }
}
