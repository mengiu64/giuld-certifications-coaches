/**
 * Lambda di orchestrazione per l'assemblaggio del question bank.
 *
 * Responsabilità:
 * - Verificare la soglia minima del 50%: se le domande generate con successo
 *   sono inferiori a ⌈planLength × 0.5⌉, la generazione viene considerata fallita
 * - Assemblare le domande in un QuestionBank e validarlo contro questionBankSchema
 * - Gestire il chunking per bank superiori a 400KB
 * - Pubblicare l'evento QuestionBankGenerated su EventBridge
 * - Aggiornare il record GENSTATUS a "COMPLETED" o "FAILED"
 *
 * Input dalla state machine:
 *   { certificationId, bankId, questions: Question[], planLength: number, executionId }
 *
 * Output:
 *   { success: true, bankId, questionCount } in caso di successo
 *   { success: false, reason: "threshold" } in caso di fallimento soglia
 *
 * @module assemble-bank
 */

import {
  certificationRegistry,
  questionBankSchema,
} from '@aws-exam-generator/shared'; // Registry certificazioni e schema di validazione
import type { Question, QuestionBank } from '@aws-exam-generator/shared'; // Tipi condivisi
import { putWithRetry, bankKey, chunkKey } from '../utils/dynamodb-client.js'; // Operazioni DynamoDB
import { publishEvent } from '../utils/eventbridge-publisher.js'; // Pubblicazione eventi
import { createLogger } from '../utils/logger.js'; // Logger strutturato

// Logger per questa funzione Lambda di orchestrazione
const logger = createLogger('assemble-bank');

// Limite massimo in byte per un singolo item DynamoDB (400KB)
const MAX_ITEM_SIZE_BYTES = 400_000;

// Margine di sicurezza per i chunk (350KB) per evitare di superare il limite
const CHUNK_TARGET_SIZE_BYTES = 350_000;

/**
 * Interfaccia per l'input ricevuto dalla state machine Step Functions.
 * Contiene tutte le informazioni necessarie per assemblare il bank.
 */
interface AssembleBankInput {
  // Identificatore della certificazione per cui generare il bank
  certificationId: string;
  // Identificatore univoco del bank da assemblare
  bankId: string;
  // Array di domande generate con successo durante l'iterazione
  questions: Question[];
  // Lunghezza totale del piano di generazione originale
  planLength: number;
  // Identificatore dell'esecuzione della state machine
  executionId: string;
}

/**
 * Interfaccia per la risposta di successo restituita alla state machine.
 */
interface AssembleBankSuccessResult {
  // Indica che l'assemblaggio è riuscito
  success: true;
  // Identificatore del bank assemblato
  bankId: string;
  // Numero totale di domande nel bank
  questionCount: number;
}

/**
 * Interfaccia per la risposta di fallimento restituita alla state machine.
 */
interface AssembleBankFailureResult {
  // Indica che l'assemblaggio è fallito
  success: false;
  // Motivo del fallimento
  reason: string;
}

// Tipo unione per il risultato dell'handler
type AssembleBankResult = AssembleBankSuccessResult | AssembleBankFailureResult;

/**
 * Handler principale per il task AssembleBank della state machine.
 * Assembla le domande in un bank, gestisce chunking e pubblica eventi.
 *
 * @param event - Input dalla state machine con domande e metadati
 * @returns Risultato dell'assemblaggio (successo o fallimento)
 */
export async function handler(event: AssembleBankInput): Promise<AssembleBankResult> {
  const { certificationId, bankId, questions, planLength, executionId } = event;

  // Imposta il requestId per la correlazione dei log
  logger.setRequestId(executionId);

  logger.info('Avvio assemblaggio question bank', {
    certificationId,
    bankId,
    questionCount: questions.length,
    planLength,
  });

  // --- Verifica soglia minima del 50% ---
  const threshold = Math.ceil(planLength * 0.5);

  if (questions.length < threshold) {
    // Le domande generate sono insufficienti rispetto alla soglia
    logger.warn('Soglia minima non raggiunta, generazione fallita', {
      questionCount: questions.length,
      threshold,
      planLength,
    });

    // Aggiornamento GENSTATUS a FAILED
    await updateGenStatus(certificationId, 'FAILED', questions.length, planLength,
      `Generazione fallita: solo ${questions.length}/${planLength} domande generate (soglia minima: ${threshold})`
    );

    // Pubblicazione evento di fallimento
    await publishEvent('generation.failed', {
      bankId,
      certificationId,
      reason: 'threshold',
      questionCount: questions.length,
      threshold,
    });

    return { success: false, reason: 'threshold' };
  }

  try {
    // --- Recupero informazioni certificazione dal registry ---
    const certConfig = certificationRegistry.getById(certificationId);
    const certificationName = certConfig?.displayName ?? certificationId;
    const examCode = certConfig?.examCode ?? certificationId;

    // Timestamp di creazione del bank
    const createdAt = new Date().toISOString();

    // --- Assemblaggio dell'oggetto QuestionBank ---
    const bank: QuestionBank = {
      bankId,
      certificationId,
      certificationName,
      examCode,
      createdAt,
      questions,
    };

    // --- Validazione contro lo schema questionBankSchema ---
    const validationResult = questionBankSchema.safeParse(bank);

    if (!validationResult.success) {
      // Validazione fallita, il bank non è conforme allo schema
      logger.error('Validazione questionBankSchema fallita', {
        errors: validationResult.error.issues.map((issue) => issue.message),
      });

      // Aggiornamento GENSTATUS a FAILED per errore di validazione
      await updateGenStatus(certificationId, 'FAILED', questions.length, planLength,
        'Generazione fallita: validazione dello schema del bank non superata'
      );

      return { success: false, reason: 'validation_failed' };
    }

    // --- Gestione chunking in base alla dimensione serializzata ---
    const serializedSize = JSON.stringify(bank).length;

    if (serializedSize <= MAX_ITEM_SIZE_BYTES) {
      // Il bank rientra nel limite di un singolo item DynamoDB
      await writeSingleItem(certificationId, bankId, bank);
    } else {
      // Il bank supera il limite, necessario chunking
      logger.info('Bank supera 400KB, avvio chunking', {
        serializedSize,
        questionCount: questions.length,
      });
      await writeChunkedBank(certificationId, bankId, bank);
    }

    // --- Pubblicazione evento QuestionBankGenerated ---
    await publishEvent('QuestionBankGenerated', {
      bankId,
      certificationId,
      questionCount: questions.length,
    });

    // --- Aggiornamento GENSTATUS a COMPLETED ---
    await updateGenStatus(certificationId, 'COMPLETED', questions.length, planLength,
      `Generazione completata: ${questions.length} domande generate con successo`
    );

    logger.info('Assemblaggio question bank completato con successo', {
      bankId,
      certificationId,
      questionCount: questions.length,
      chunked: serializedSize > MAX_ITEM_SIZE_BYTES,
    });

    return { success: true, bankId, questionCount: questions.length };
  } catch (error) {
    // Errore imprevisto durante l'assemblaggio
    logger.error('Errore durante assemblaggio del question bank', {
      error: error instanceof Error ? error.message : String(error),
      bankId,
      certificationId,
    });

    // Aggiornamento GENSTATUS a FAILED per errore generico
    await updateGenStatus(certificationId, 'FAILED', questions.length, planLength,
      `Generazione fallita: errore durante l'assemblaggio del bank`
    );

    return { success: false, reason: 'assembly_error' };
  }
}

/**
 * Scrive il bank come singolo item in DynamoDB (quando la dimensione è ≤400KB).
 * Include tutti i campi del bank più il questionCount per query rapide.
 *
 * @param certificationId - ID della certificazione
 * @param bankId - ID univoco del bank
 * @param bank - Oggetto QuestionBank completo
 */
async function writeSingleItem(
  certificationId: string,
  bankId: string,
  bank: QuestionBank
): Promise<void> {
  // Generazione chiavi DynamoDB per il bank
  const keys = bankKey(certificationId, bankId);

  // Scrittura dell'item completo con retry
  await putWithRetry({
    ...keys,
    bankId,
    certificationId,
    certificationName: bank.certificationName,
    examCode: bank.examCode,
    createdAt: bank.createdAt,
    questions: bank.questions,
    questionCount: bank.questions.length,
  });

  logger.info('Bank scritto come singolo item', { bankId, certificationId });
}

/**
 * Scrive il bank in formato chunked quando supera il limite di 400KB.
 * Crea un record base (senza domande) e chunk separati per le domande.
 *
 * Strategia di chunking:
 * - Record base: pk = BANK#<certId>, sk = BANK#<bankId>, con campo chunkCount
 * - Ogni chunk: pk = BANK#<certId>#<bankId>, sk = CHUNK#<index>, con subset di domande
 * - Ogni chunk ha dimensione target di ~350KB per lasciare margine di sicurezza
 *
 * @param certificationId - ID della certificazione
 * @param bankId - ID univoco del bank
 * @param bank - Oggetto QuestionBank completo da suddividere
 */
async function writeChunkedBank(
  certificationId: string,
  bankId: string,
  bank: QuestionBank
): Promise<void> {
  // Suddivisione delle domande in chunk che rispettano il limite di dimensione
  const chunks = splitQuestionsIntoChunks(bank.questions);

  // Generazione chiavi per il record base del bank
  const baseKeys = bankKey(certificationId, bankId);

  // Scrittura del record base senza il campo questions, con chunkCount
  await putWithRetry({
    ...baseKeys,
    bankId,
    certificationId,
    certificationName: bank.certificationName,
    examCode: bank.examCode,
    createdAt: bank.createdAt,
    questionCount: bank.questions.length,
    chunkCount: chunks.length,
  });

  // Scrittura di ogni chunk con le relative domande
  for (let index = 0; index < chunks.length; index++) {
    const chunkKeys = chunkKey(certificationId, bankId, index);

    await putWithRetry({
      ...chunkKeys,
      questions: chunks[index],
      chunkIndex: index,
    });
  }

  logger.info('Bank scritto in formato chunked', {
    bankId,
    certificationId,
    chunkCount: chunks.length,
  });
}

/**
 * Suddivide un array di domande in chunk che rispettano il limite di dimensione.
 * Ogni chunk viene serializzato e verificato contro CHUNK_TARGET_SIZE_BYTES.
 *
 * Algoritmo:
 * 1. Aggiunge domande una alla volta al chunk corrente
 * 2. Verifica la dimensione serializzata dopo ogni aggiunta
 * 3. Se il limite viene superato, inizia un nuovo chunk
 * 4. Garantisce che ogni domanda sia inclusa in esattamente un chunk
 *
 * @param questions - Array completo di domande da suddividere
 * @returns Array di chunk, ciascuno contenente un sottoinsieme delle domande
 */
function splitQuestionsIntoChunks(questions: Question[]): Question[][] {
  const chunks: Question[][] = [];
  let currentChunk: Question[] = [];

  for (const question of questions) {
    // Aggiunge la domanda al chunk corrente per verifica dimensione
    currentChunk.push(question);

    // Calcolo dimensione serializzata del chunk corrente
    const chunkSize = JSON.stringify(currentChunk).length;

    if (chunkSize > CHUNK_TARGET_SIZE_BYTES && currentChunk.length > 1) {
      // Il chunk supera il limite, rimuove l'ultima domanda e chiude il chunk
      currentChunk.pop();
      chunks.push(currentChunk);

      // Inizia un nuovo chunk con la domanda che ha causato il superamento
      currentChunk = [question];
    }
  }

  // Aggiunge l'ultimo chunk se contiene domande
  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

/**
 * Aggiorna il record GENSTATUS in DynamoDB con lo stato corrente della generazione.
 * Scrive il record con chiave pk = GENSTATUS#<certId>, sk = GENSTATUS#latest.
 *
 * @param certificationId - ID della certificazione
 * @param state - Stato della generazione ("COMPLETED" o "FAILED")
 * @param generatedQuestions - Numero di domande generate con successo
 * @param targetQuestions - Numero totale di domande previste dal piano
 * @param message - Messaggio descrittivo dello stato
 */
async function updateGenStatus(
  certificationId: string,
  state: 'COMPLETED' | 'FAILED',
  generatedQuestions: number,
  targetQuestions: number,
  message: string
): Promise<void> {
  try {
    // Scrittura del record di stato con timestamp aggiornato
    await putWithRetry({
      pk: `GENSTATUS#${certificationId}`,
      sk: 'GENSTATUS#latest',
      state,
      certificationId,
      generatedQuestions,
      targetQuestions,
      updatedAt: new Date().toISOString(),
      message,
    });
  } catch (error) {
    // Log dell'errore senza propagazione per non bloccare il flusso principale
    logger.error('Errore durante aggiornamento GENSTATUS', {
      certificationId,
      state,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
