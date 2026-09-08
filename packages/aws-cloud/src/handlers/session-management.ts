/**
 * Handler Lambda per la gestione delle sessioni d'esame.
 *
 * Gestisce un handler multi-operazione che instrada le richieste in base
 * al metodo HTTP e al percorso. Operazioni supportate:
 * - POST /sessions → Crea nuova sessione
 * - POST /sessions/{sessionId}/answer → Sottometti risposta
 * - POST /sessions/{sessionId}/pause → Metti in pausa la sessione
 * - POST /sessions/{sessionId}/resume → Riprendi la sessione
 * - POST /sessions/{sessionId}/submit → Invia sessione per valutazione
 * - POST /sessions/{sessionId}/study-check → Verifica risposta in modalità studio
 * - GET /sessions/{sessionId} → Recupera stato della sessione
 * - GET /sessions/{sessionId}/result → Recupera risultato dell'esame
 *
 * Input: APIGatewayProxyEvent con percorso, metodo e body
 * Output: ApiGatewayResponse con codice appropriato
 */

import type { APIGatewayProxyEvent } from 'aws-lambda'; // Tipo evento API Gateway
import {
  certificationRegistry,
  createExamSession,
  upsertAnswer,
  calculateExamResult,
  isAnswerCorrect,
  recordStudyResult,
} from '@aws-exam-generator/shared'; // Utilità dal pacchetto condiviso
import {
  getItem,
  putWithRetry,
  queryItems,
  sessionKey,
  resultKey,
  bankKey,
} from '../utils/dynamodb-client.js'; // Operazioni DynamoDB
import {
  ok,
  created,
  badRequest,
  notFound,
  conflict,
  internalError,
} from '../utils/response.js'; // Helper per le risposte
import type { ApiGatewayResponse } from '../utils/response.js'; // Tipo risposta API Gateway
import { createLogger } from '../utils/logger.js'; // Factory per il logger strutturato
import { publishEvent } from '../utils/eventbridge-publisher.js'; // Publisher EventBridge
import type { ExamSession, QuestionBank, Question } from '@aws-exam-generator/shared'; // Tipi condivisi
import { enhancedStudyResponseSchema } from '@aws-exam-generator/shared'; // Schema di validazione risposta arricchita
import {
  buildStudyPrompt,
  parseBedrockStudyResponse,
  completeOptionAnalysis,
  buildEnhancedResponse,
  validateMermaidSyntax,
} from '../utils/enhanced-study-response.js'; // Modulo costruzione risposte arricchite studio
import type { EnhancedStudyContext } from '../utils/enhanced-study-response.js'; // Tipo contesto per la risposta arricchita
import { invokeModelRaw } from '../utils/bedrock-client.js'; // Invocazione Bedrock senza validazione schema
import { loadConfig } from '../utils/ssm-config.js'; // Caricamento configurazione da SSM Parameter Store
import type { AppConfig } from '../utils/ssm-config.js'; // Tipo configurazione applicativa

// Istanza del logger per questa funzione Lambda
const logger = createLogger('session-management');

/**
 * Handler principale per la gestione delle sessioni.
 * Instrada la richiesta all'operazione appropriata in base al percorso e metodo HTTP.
 *
 * @param event - Evento API Gateway contenente la richiesta HTTP
 * @returns Risposta API Gateway con codice appropriato
 */
export async function handler(event: APIGatewayProxyEvent): Promise<ApiGatewayResponse> {
  // Imposta il requestId di correlazione dal contesto API Gateway
  logger.setRequestId(event.requestContext?.requestId ?? 'unknown');

  logger.info('Richiesta gestione sessione ricevuta', {
    method: event.httpMethod,
    path: event.path,
  });

  try {
    // Determinazione dell'operazione in base al metodo e percorso
    const method = event.httpMethod?.toUpperCase();
    const path = event.path ?? '';
    const sessionId = event.pathParameters?.sessionId;

    // Instradamento basato su metodo HTTP e percorso
    if (method === 'POST' && !sessionId && path.endsWith('/sessions')) {
      // POST /sessions → Creazione nuova sessione
      return await handleCreateSession(event);
    }

    if (method === 'GET' && sessionId) {
      // GET /sessions/{sessionId}/result → Recupero risultato esame
      if (path.endsWith('/result')) {
        return await handleGetResult(sessionId);
      }
      // GET /sessions/{sessionId} → Recupero stato sessione
      return await handleGetSession(sessionId);
    }

    if (method === 'POST' && sessionId) {
      // POST /sessions/{sessionId}/<azione> → Operazione sulla sessione
      if (path.endsWith('/answer')) {
        return await handleAnswer(sessionId, event);
      }
      if (path.endsWith('/pause')) {
        return await handlePause(sessionId);
      }
      if (path.endsWith('/resume')) {
        return await handleResume(sessionId);
      }
      if (path.endsWith('/submit')) {
        return await handleSubmit(sessionId);
      }
      if (path.endsWith('/study-check')) {
        return await handleStudyCheck(sessionId, event);
      }
    }

    // Percorso non riconosciuto
    logger.warn('Percorso non riconosciuto', { method, path });
    return badRequest('Percorso non riconosciuto.');
  } catch (error) {
    // Errore imprevisto durante l'elaborazione
    logger.error('Errore durante la gestione della sessione', {
      error: error instanceof Error ? error.message : String(error),
    });
    return internalError();
  }
}

// --- Operazioni sulla sessione ---

/**
 * Crea una nuova sessione d'esame.
 * Genera l'ordine casuale delle domande, imposta il tempo residuo
 * dalla configurazione della certificazione (esame) o 0 (studio).
 *
 * @param event - Evento contenente bankId, certificationId e mode nel body
 * @returns Risposta 201 con la sessione creata
 */
async function handleCreateSession(event: APIGatewayProxyEvent): Promise<ApiGatewayResponse> {
  // Parsing del body della richiesta
  const body = parseBody(event.body);

  if (!body || !body.bankId || !body.certificationId || !body.mode) {
    // Parametri obbligatori mancanti nel body
    logger.warn('Parametri mancanti per la creazione della sessione');
    return badRequest('I campi bankId, certificationId e mode sono obbligatori.');
  }

  const { bankId, certificationId, mode } = body;

  // Validazione della modalità d'esame
  if (mode !== 'exam' && mode !== 'study') {
    logger.warn('Modalità non valida', { mode });
    return badRequest('Il campo mode deve essere "exam" o "study".');
  }

  // Recupero della configurazione della certificazione dal registry
  const certConfig = certificationRegistry.getById(certificationId as string);
  if (!certConfig) {
    // Certificazione sconosciuta
    logger.warn('Certificazione sconosciuta', { certificationId });
    return badRequest(`Unknown certification: ${certificationId}`);
  }

  // Recupero della question bank da DynamoDB (gestendo eventuali chunk)
  const bank = await loadBank(certificationId as string, bankId as string);
  if (!bank) {
    // Bank non trovata
    logger.warn('Question bank non trovata', { bankId, certificationId });
    return notFound(`Bank ${bankId} not found.`);
  }

  // Determina il limite di tempo dalla configurazione della certificazione
  const timeLimitMinutes = certConfig.timeLimitMinutes;

  // Creazione della sessione tramite la funzione condivisa
  const session = createExamSession(bank, mode as 'exam' | 'study', timeLimitMinutes);

  // Persistenza della sessione in DynamoDB
  await putWithRetry({
    ...sessionKey(session.sessionId),
    ...session,
  });

  logger.info('Sessione creata con successo', {
    sessionId: session.sessionId,
    bankId,
    certificationId,
    mode,
    questionCount: bank.questions.length,
  });

  // Risposta 201 Created con la sessione creata
  return created(session);
}

/**
 * Recupera lo stato corrente di una sessione d'esame.
 *
 * @param sessionId - Identificatore univoco della sessione
 * @returns Risposta 200 con la sessione o 404 se non trovata
 */
async function handleGetSession(sessionId: string): Promise<ApiGatewayResponse> {
  // Recupero della sessione da DynamoDB
  const record = await getItem(sessionKey(sessionId));

  if (!record) {
    // Sessione non trovata
    logger.warn('Sessione non trovata', { sessionId });
    return notFound(`Session ${sessionId} not found.`);
  }

  logger.info('Sessione recuperata con successo', { sessionId });
  return ok(recordToSession(record));
}

/**
 * Recupera il risultato di un esame completato.
 *
 * @param sessionId - Identificatore univoco della sessione
 * @returns Risposta 200 con il risultato o 404 se non trovato
 */
async function handleGetResult(sessionId: string): Promise<ApiGatewayResponse> {
  // Recupero del risultato da DynamoDB tramite la chiave risultato
  const record = await getItem(resultKey(sessionId));

  if (!record) {
    // Risultato non trovato per la sessione specificata
    logger.warn('Risultato non trovato per la sessione', { sessionId });
    return notFound(`No result for session ${sessionId}.`);
  }

  logger.info('Risultato recuperato con successo', { sessionId });
  return ok(record);
}

/**
 * Sottomette una risposta per una specifica domanda nella sessione.
 * Valida che l'indice sia nell'intervallo valido e che la sessione sia in corso.
 *
 * @param sessionId - Identificatore univoco della sessione
 * @param event - Evento contenente questionIndex e selectedAnswers nel body
 * @returns Risposta 200 con la sessione aggiornata
 */
async function handleAnswer(sessionId: string, event: APIGatewayProxyEvent): Promise<ApiGatewayResponse> {
  // Parsing del body della richiesta
  const body = parseBody(event.body);

  if (!body || body.questionIndex === undefined || !Array.isArray(body.selectedAnswers)) {
    // Parametri obbligatori mancanti
    logger.warn('Parametri mancanti per la sottomissione risposta', { sessionId });
    return badRequest('I campi questionIndex e selectedAnswers sono obbligatori.');
  }

  const { questionIndex, selectedAnswers } = body;

  // Recupero della sessione da DynamoDB
  const record = await getItem(sessionKey(sessionId));

  if (!record) {
    // Sessione non trovata
    logger.warn('Sessione non trovata per sottomissione risposta', { sessionId });
    return notFound(`Session ${sessionId} not found.`);
  }

  // Ricostruzione dell'oggetto sessione dal record DynamoDB
  const session = recordToSession(record);

  // Verifica che la sessione sia nello stato "in_progress"
  if (session.status !== 'in_progress') {
    logger.warn('Tentativo di risposta su sessione non attiva', {
      sessionId,
      status: session.status,
    });
    return conflict(`Cannot answer session in ${session.status} state.`);
  }

  // Validazione dell'indice della domanda nell'intervallo valido
  if ((questionIndex as number) < 0 || (questionIndex as number) >= session.questionOrder.length) {
    logger.warn('Indice domanda fuori dall\'intervallo', {
      sessionId,
      questionIndex,
      maxIndex: session.questionOrder.length - 1,
    });
    return badRequest(`L'indice della domanda deve essere tra 0 e ${session.questionOrder.length - 1}.`);
  }

  // Aggiornamento della sessione con la nuova risposta tramite utility condivisa
  const updatedSession = upsertAnswer(session, questionIndex as number, selectedAnswers as string[]);

  // Persistenza della sessione aggiornata in DynamoDB
  await putWithRetry({
    ...sessionKey(sessionId),
    ...updatedSession,
  });

  logger.info('Risposta sottomessa con successo', { sessionId, questionIndex });
  return ok(updatedSession);
}

/**
 * Mette in pausa una sessione d'esame.
 * Richiede che la sessione sia nello stato "in_progress".
 * Persiste il tempo residuo per il ripristino successivo.
 *
 * @param sessionId - Identificatore univoco della sessione
 * @returns Risposta 200 con la sessione messa in pausa
 */
async function handlePause(sessionId: string): Promise<ApiGatewayResponse> {
  // Recupero della sessione da DynamoDB
  const record = await getItem(sessionKey(sessionId));

  if (!record) {
    // Sessione non trovata
    logger.warn('Sessione non trovata per pausa', { sessionId });
    return notFound(`Session ${sessionId} not found.`);
  }

  // Ricostruzione dell'oggetto sessione dal record DynamoDB
  const session = recordToSession(record);

  // Verifica che la sessione sia nello stato "in_progress"
  if (session.status !== 'in_progress') {
    logger.warn('Tentativo di pausa su sessione non attiva', {
      sessionId,
      status: session.status,
    });
    return conflict(`Cannot pause session in ${session.status} state.`);
  }

  // Aggiornamento dello stato a "paused", preservando il tempo residuo
  const pausedSession: ExamSession = {
    ...session,
    status: 'paused',
  };

  // Persistenza della sessione in pausa in DynamoDB
  await putWithRetry({
    ...sessionKey(sessionId),
    ...pausedSession,
  });

  logger.info('Sessione messa in pausa', { sessionId, timeRemainingMs: pausedSession.timeRemainingMs });
  return ok(pausedSession);
}

/**
 * Riprende una sessione d'esame in pausa.
 * Richiede che la sessione sia nello stato "paused".
 * Ripristina il tempo residuo salvato durante la pausa.
 *
 * @param sessionId - Identificatore univoco della sessione
 * @returns Risposta 200 con la sessione ripresa
 */
async function handleResume(sessionId: string): Promise<ApiGatewayResponse> {
  // Recupero della sessione da DynamoDB
  const record = await getItem(sessionKey(sessionId));

  if (!record) {
    // Sessione non trovata
    logger.warn('Sessione non trovata per ripresa', { sessionId });
    return notFound(`Session ${sessionId} not found.`);
  }

  // Ricostruzione dell'oggetto sessione dal record DynamoDB
  const session = recordToSession(record);

  // Verifica che la sessione sia nello stato "paused"
  if (session.status !== 'paused') {
    logger.warn('Tentativo di ripresa su sessione non in pausa', {
      sessionId,
      status: session.status,
    });
    return conflict(`Cannot resume session in ${session.status} state.`);
  }

  // Aggiornamento dello stato a "in_progress", ripristinando il tempo residuo
  const resumedSession: ExamSession = {
    ...session,
    status: 'in_progress',
  };

  // Persistenza della sessione ripresa in DynamoDB
  await putWithRetry({
    ...sessionKey(sessionId),
    ...resumedSession,
  });

  logger.info('Sessione ripresa', { sessionId, timeRemainingMs: resumedSession.timeRemainingMs });
  return ok(resumedSession);
}

/**
 * Finalizza una sessione d'esame, calcolando il punteggio.
 * Accetta sessioni in stato "in_progress" o "paused".
 * Calcola il risultato tramite la logica condivisa, persiste il risultato
 * e pubblica l'evento ExamSessionSubmitted su EventBridge.
 *
 * @param sessionId - Identificatore univoco della sessione
 * @returns Risposta 200 con il risultato dell'esame
 */
async function handleSubmit(sessionId: string): Promise<ApiGatewayResponse> {
  // Recupero della sessione da DynamoDB
  const record = await getItem(sessionKey(sessionId));

  if (!record) {
    // Sessione non trovata
    logger.warn('Sessione non trovata per sottomissione', { sessionId });
    return notFound(`Session ${sessionId} not found.`);
  }

  // Ricostruzione dell'oggetto sessione dal record DynamoDB
  const session = recordToSession(record);

  // Verifica che la sessione sia nello stato "in_progress" o "paused"
  if (session.status !== 'in_progress' && session.status !== 'paused') {
    logger.warn('Tentativo di sottomissione su sessione non valida', {
      sessionId,
      status: session.status,
    });
    return conflict(`Cannot submit session in ${session.status} state.`);
  }

  // Recupero della question bank associata alla sessione (gestendo chunk)
  const bank = await loadBank(session.certificationId, session.bankId);

  if (!bank) {
    // Bank non trovata (errore di consistenza dati)
    logger.error('Question bank associata alla sessione non trovata', {
      sessionId,
      bankId: session.bankId,
      certificationId: session.certificationId,
    });
    return internalError();
  }

  // Calcolo del risultato tramite la funzione condivisa di scoring
  const result = calculateExamResult(session, bank);

  // Aggiornamento dello stato della sessione a "submitted"
  const submittedSession: ExamSession = {
    ...session,
    status: 'submitted',
  };

  // Persistenza della sessione finalizzata in DynamoDB
  await putWithRetry({
    ...sessionKey(sessionId),
    ...submittedSession,
  });

  // Persistenza del risultato in DynamoDB
  await putWithRetry({
    ...resultKey(sessionId),
    ...result,
  });

  // Pubblicazione dell'evento ExamSessionSubmitted su EventBridge
  await publishEvent('ExamSessionSubmitted', {
    sessionId,
    score: result.score,
    passed: result.passed,
  });

  logger.info('Sessione sottomessa e risultato calcolato', {
    sessionId,
    score: result.score,
    passed: result.passed,
    correctCount: result.correctCount,
    totalQuestions: result.totalQuestions,
  });

  return ok(result);
}

/**
 * Verifica la correttezza di una risposta in modalità studio.
 * Disponibile solo per sessioni in modalità "study" e stato "in_progress".
 * Restituisce una risposta arricchita con spiegazione dettagliata, analisi opzioni
 * e diagramma Mermaid se disponibile; in caso di errore, fallback alla risposta base.
 *
 * @param sessionId - Identificatore univoco della sessione
 * @param event - Evento contenente questionIndex e selectedAnswers nel body
 * @returns Risposta 200 con Enhanced_Study_Response o risposta base come fallback
 */
async function handleStudyCheck(sessionId: string, event: APIGatewayProxyEvent): Promise<ApiGatewayResponse> {
  // Parsing del body della richiesta
  const body = parseBody(event.body);

  if (!body || body.questionIndex === undefined || !Array.isArray(body.selectedAnswers)) {
    // Parametri obbligatori mancanti
    logger.warn('Parametri mancanti per verifica studio', { sessionId });
    return badRequest('I campi questionIndex e selectedAnswers sono obbligatori.');
  }

  const { questionIndex, selectedAnswers } = body;

  // Recupero della sessione da DynamoDB
  const record = await getItem(sessionKey(sessionId));

  if (!record) {
    // Sessione non trovata
    logger.warn('Sessione non trovata per verifica studio', { sessionId });
    return notFound(`Session ${sessionId} not found.`);
  }

  // Ricostruzione dell'oggetto sessione dal record DynamoDB
  const session = recordToSession(record);

  // Verifica che la sessione sia in modalità studio
  if (session.mode !== 'study') {
    logger.warn('Tentativo di study-check su sessione non in modalità studio', {
      sessionId,
      mode: session.mode,
    });
    return conflict(`Cannot perform study-check on session in ${session.mode} mode.`);
  }

  // Verifica che la sessione sia nello stato "in_progress"
  if (session.status !== 'in_progress') {
    logger.warn('Tentativo di study-check su sessione non attiva', {
      sessionId,
      status: session.status,
    });
    return conflict(`Cannot study-check session in ${session.status} state.`);
  }

  // Validazione dell'indice della domanda nell'intervallo valido
  if ((questionIndex as number) < 0 || (questionIndex as number) >= session.questionOrder.length) {
    logger.warn('Indice domanda fuori dall\'intervallo per study-check', {
      sessionId,
      questionIndex,
      maxIndex: session.questionOrder.length - 1,
    });
    return badRequest(`L'indice della domanda deve essere tra 0 e ${session.questionOrder.length - 1}.`);
  }

  // Recupero della question bank per ottenere la domanda specifica (gestendo chunk)
  const bank = await loadBank(session.certificationId, session.bankId);

  if (!bank) {
    // Bank non trovata (errore di consistenza dati)
    logger.error('Question bank associata alla sessione non trovata per study-check', {
      sessionId,
      bankId: session.bankId,
    });
    return internalError();
  }

  // Recupero della domanda tramite l'ordine casuale della sessione
  const actualIndex = session.questionOrder[questionIndex as number] as number;
  const question = bank.questions[actualIndex];

  if (!question) {
    // Domanda non trovata nell'array delle domande
    logger.error('Domanda non trovata nella bank', { sessionId, questionIndex, actualIndex });
    return internalError();
  }

  // Valutazione della correttezza tramite la funzione condivisa
  const correct = isAnswerCorrect(question, selectedAnswers as string[]);

  // Risposta base di fallback (utilizzata se la pipeline arricchita fallisce)
  const baseResponse = {
    isCorrect: correct,
    explanation: question.explanation,
  };

  // --- Inizio pipeline di generazione della risposta arricchita ---
  try {
    // Log INFO: inizio generazione arricchita con contesto della domanda
    logger.info('Inizio generazione risposta arricchita studio', {
      sessionId,
      questionIndex,
      servicesCount: question.services.length,
    });

    // Registra il timestamp di inizio per il calcolo della latenza totale
    const startTime = Date.now();

    // Caricamento della configurazione applicativa da SSM Parameter Store
    const config: AppConfig = await loadConfig(process.env.APP_ENV ?? 'dev');

    // Costruzione del contesto per la generazione della risposta arricchita
    const context: EnhancedStudyContext = {
      question, // Domanda originale con stem, opzioni, risposte corrette
      selectedAnswers: selectedAnswers as string[], // Risposte selezionate dall'utente
      isCorrect: correct, // Risultato della valutazione di correttezza
      baseExplanation: question.explanation, // Spiegazione base dalla domanda
    };

    // Costruzione del system prompt e user prompt per l'invocazione Bedrock
    const { systemPrompt, userPrompt } = buildStudyPrompt(context);

    // Invocazione del modello Bedrock per generare la risposta arricchita
    const rawResponse = await invokeModelRaw(systemPrompt, userPrompt, config);

    // Calcolo della latenza dell'invocazione Bedrock in millisecondi
    const bedrockLatency = Date.now() - startTime;

    // Log INFO: latenza dell'invocazione Bedrock
    logger.info('Invocazione Bedrock completata per risposta arricchita', {
      sessionId,
      bedrockLatencyMs: bedrockLatency,
    });

    // Log WARNING: se il tempo di generazione supera i 10 secondi (potenziale degradazione)
    if (bedrockLatency > 10000) {
      logger.warn('Tempo di generazione risposta arricchita superiore a 10 secondi', {
        sessionId,
        bedrockLatencyMs: bedrockLatency,
      });
    }

    // Parsing della risposta grezza di Bedrock per estrarre i dati strutturati
    const bedrockData = parseBedrockStudyResponse(rawResponse, context);

    // Validazione del diagramma Mermaid se presente nella risposta Bedrock
    if (bedrockData !== null && bedrockData.diagram !== null) {
      // Verifica che la sintassi del diagramma sia valida
      if (!validateMermaidSyntax(bedrockData.diagram)) {
        // Log WARNING: diagramma con sintassi Mermaid invalida
        logger.warn('Diagramma Mermaid con sintassi invalida, impostato a null', {
          sessionId,
          diagramPreview: bedrockData.diagram.substring(0, 50),
        });
        // Imposta il diagramma a null in caso di sintassi invalida
        bedrockData.diagram = null;
      }
    }

    // Verifica completezza dell'optionAnalysis rispetto alle opzioni della domanda
    if (bedrockData !== null && bedrockData.optionAnalysis.length !== question.options.length) {
      // Log WARNING: optionAnalysis incompleto, verrà completato con placeholder generici
      logger.warn('optionAnalysis incompleto nella risposta Bedrock, completamento con placeholder', {
        sessionId,
        expectedOptions: question.options.length,
        receivedOptions: bedrockData.optionAnalysis.length,
      });
    }

    // Assemblaggio della risposta arricchita finale combinando contesto e dati Bedrock
    const enhancedResponse = buildEnhancedResponse(context, bedrockData);

    // Validazione della risposta arricchita contro lo schema Zod
    const validation = enhancedStudyResponseSchema.safeParse(enhancedResponse);

    // Se la validazione dello schema fallisce, fallback alla risposta base
    if (!validation.success) {
      // Log ERROR: validazione schema fallita, utilizzo risposta base
      logger.error('Validazione schema risposta arricchita fallita, fallback a risposta base', {
        sessionId,
        validationErrors: validation.error.issues.map((i) => i.message),
      });

      // Registrazione del risultato dello studio nella sessione (sempre eseguita)
      const updatedSession = recordStudyResult(session, questionIndex as number, selectedAnswers as string[], correct);

      // Persistenza della sessione aggiornata in DynamoDB
      await putWithRetry({
        ...sessionKey(sessionId),
        ...updatedSession,
      });

      // Risposta base come fallback in caso di errore di validazione
      return ok(baseResponse);
    }

    // Calcolo della latenza totale della pipeline arricchita
    const totalLatency = Date.now() - startTime;

    // Log INFO: completamento della generazione arricchita con metriche
    logger.info('Generazione risposta arricchita completata con successo', {
      sessionId,
      totalLatencyMs: totalLatency,
      hasDiagram: validation.data.diagram !== null,
      optionAnalysisCount: validation.data.optionAnalysis.length,
    });

    // Registrazione del risultato dello studio nella sessione
    const updatedSession = recordStudyResult(session, questionIndex as number, selectedAnswers as string[], correct);

    // Persistenza della sessione aggiornata in DynamoDB
    await putWithRetry({
      ...sessionKey(sessionId),
      ...updatedSession,
    });

    // Risposta con la risposta arricchita validata
    return ok(validation.data);
  } catch (error) {
    // Log ERROR: errore imprevisto nella pipeline arricchita, fallback a risposta base
    logger.error('Errore durante la generazione della risposta arricchita, fallback a risposta base', {
      sessionId,
      error: error instanceof Error ? error.message : String(error),
    });

    // Registrazione del risultato dello studio nella sessione (sempre eseguita)
    const updatedSession = recordStudyResult(session, questionIndex as number, selectedAnswers as string[], correct);

    // Persistenza della sessione aggiornata in DynamoDB
    await putWithRetry({
      ...sessionKey(sessionId),
      ...updatedSession,
    });

    // Risposta base come fallback in caso di qualsiasi errore nella pipeline
    return ok(baseResponse);
  }
}

// --- Funzioni di utilità ---

/**
 * Carica una question bank da DynamoDB, gestendo trasparentemente
 * il riassemblaggio dei chunk per bank di grandi dimensioni (>400KB).
 *
 * @param certificationId - Identificatore della certificazione
 * @param bankId - Identificatore della question bank
 * @returns QuestionBank completa o null se non trovata
 */
async function loadBank(certificationId: string, bankId: string): Promise<QuestionBank | null> {
  // Recupero del record base della bank da DynamoDB
  const bankRecord = await getItem(bankKey(certificationId, bankId));

  if (!bankRecord) {
    // Bank non trovata in DynamoDB
    return null;
  }

  // Verifica se la bank è suddivisa in chunk
  const chunkCount = bankRecord.chunkCount as number | undefined;

  if (!chunkCount || chunkCount <= 0) {
    // La bank contiene le domande direttamente nel record base
    return {
      bankId: (bankRecord.bankId as string) ?? bankId,
      certificationId: (bankRecord.certificationId as string) ?? certificationId,
      certificationName: bankRecord.certificationName as string,
      examCode: bankRecord.examCode as string,
      createdAt: bankRecord.createdAt as string,
      questions: (bankRecord.questions as Question[]) ?? [],
    };
  }

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
    const indexA = parseInt((a.sk as string).replace('CHUNK#', ''), 10);
    const indexB = parseInt((b.sk as string).replace('CHUNK#', ''), 10);
    return indexA - indexB; // Ordinamento crescente per indice
  });

  // Riassemblaggio dell'array completo delle domande concatenando i chunk ordinati
  const allQuestions: Question[] = [];
  for (const chunk of sortedChunks) {
    const chunkQuestions = chunk.questions as Question[];
    if (Array.isArray(chunkQuestions)) {
      allQuestions.push(...chunkQuestions); // Concatenazione delle domande del chunk
    }
  }

  // Costruzione dell'oggetto QuestionBank completo
  return {
    bankId: (bankRecord.bankId as string) ?? bankId,
    certificationId: (bankRecord.certificationId as string) ?? certificationId,
    certificationName: bankRecord.certificationName as string,
    examCode: bankRecord.examCode as string,
    createdAt: bankRecord.createdAt as string,
    questions: allQuestions,
  };
}

/**
 * Effettua il parsing sicuro del body JSON della richiesta.
 * Restituisce null se il body è assente o malformato.
 *
 * @param body - Body della richiesta come stringa JSON o null
 * @returns Oggetto parsato o null in caso di errore
 */
function parseBody(body: string | null): Record<string, unknown> | null {
  if (!body) {
    // Body assente nella richiesta
    return null;
  }

  try {
    // Tentativo di parsing JSON del body
    return JSON.parse(body) as Record<string, unknown>;
  } catch {
    // Body malformato, non è JSON valido
    return null;
  }
}

/**
 * Ricostruisce un oggetto ExamSession da un record DynamoDB.
 * Mappa i campi del record ai tipi corretti dell'interfaccia ExamSession.
 *
 * @param record - Record DynamoDB contenente i dati della sessione
 * @returns Oggetto ExamSession tipizzato correttamente
 */
function recordToSession(record: Record<string, unknown>): ExamSession {
  return {
    sessionId: record.sessionId as string,
    bankId: record.bankId as string,
    certificationId: record.certificationId as string,
    mode: record.mode as ExamSession['mode'],
    status: record.status as ExamSession['status'],
    startedAt: record.startedAt as string,
    timeRemainingMs: record.timeRemainingMs as number,
    questionOrder: record.questionOrder as number[],
    answers: (record.answers as ExamSession['answers']) ?? [],
    markedForReview: (record.markedForReview as number[]) ?? [],
    studyResults: record.studyResults as ExamSession['studyResults'],
  };
}
