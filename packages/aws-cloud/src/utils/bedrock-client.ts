/**
 * Modulo client per Amazon Bedrock (Converse API).
 *
 * Funzioni pubbliche:
 * - `invokeModel(systemPrompt, userPrompt, config)`: invoca il modello Bedrock,
 *   valida la risposta contro lo schema Zod e gestisce retry per throttling
 *   e feedback correttivo in caso di errore di validazione.
 *
 * Caratteristiche:
 * - Timeout di 30s per invocazione tramite AbortController
 * - Retry con backoff esponenziale per ThrottlingException (1s, 2s, 4s)
 * - Fino a 2 tentativi aggiuntivi con feedback correttivo su errore di validazione
 * - Logging strutturato di model ID, token di input/output e latenza
 */

import {
  BedrockRuntimeClient,
  ConverseCommand,
} from '@aws-sdk/client-bedrock-runtime'; // Client e comando per la Converse API di Bedrock
import {
  generatedQuestionDraftSchema,
  BEDROCK_RETRY_DELAYS_MS,
} from '@aws-exam-generator/shared'; // Schema di validazione e costanti di retry dal pacchetto condiviso
import type { GeneratedQuestionDraft } from '@aws-exam-generator/shared'; // Tipo della risposta validata
import type { AppConfig } from './ssm-config.js'; // Tipo della configurazione applicativa

// Pausa asincrona per i ritardi di retry
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Verifica se un errore è di tipo ThrottlingException di Bedrock.
 *
 * @param error - L'errore catturato durante l'invocazione
 * @returns true se l'errore è dovuto a throttling
 */
function isThrottlingError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false; // Non è un oggetto Error, non può essere throttling
  }
  // Controlla il nome dell'errore o la presenza di "ThrottlingException" nel messaggio
  return (
    error.name === 'ThrottlingException' ||
    error.name === 'TooManyRequestsException' ||
    error.message.includes('ThrottlingException')
  );
}

/**
 * Estrae il testo dalla risposta della Converse API di Bedrock.
 *
 * @param content - Array di blocchi di contenuto dalla risposta
 * @returns Il testo concatenato della risposta
 */
function extractTextFromResponse(
  content: Array<{ text?: string }> | undefined,
): string {
  if (!content) {
    return ''; // Nessun contenuto nella risposta
  }
  // Concatena tutti i blocchi di testo della risposta
  return content
    .map((block) => ('text' in block && typeof block.text === 'string' ? block.text : ''))
    .join('')
    .trim();
}

/**
 * Invoca il modello Bedrock tramite la Converse API con gestione completa di:
 * - Timeout (30s tramite AbortController)
 * - Retry per throttling (backoff: 1s, 2s, 4s)
 * - Validazione della risposta contro generatedQuestionDraftSchema
 * - Retry con feedback correttivo su errore di validazione (max 2 tentativi aggiuntivi)
 * - Logging strutturato di metriche (model ID, token, latenza)
 *
 * @param systemPrompt - Il prompt di sistema per istruire il modello
 * @param userPrompt - Il prompt utente con la richiesta specifica
 * @param config - Configurazione applicativa con model ID e timeout
 * @returns L'oggetto GeneratedQuestionDraft validato
 * @throws Errore se tutti i tentativi sono esauriti
 */
export async function invokeModel(
  systemPrompt: string,
  userPrompt: string,
  config: AppConfig,
): Promise<GeneratedQuestionDraft> {
  // Istanza del client Bedrock Runtime
  const client = new BedrockRuntimeClient({});

  // Numero massimo di tentativi con feedback correttivo per errori di validazione
  const maxValidationRetries = 2;

  // Prompt corrente (viene modificato con feedback correttivo in caso di errore di validazione)
  let currentUserPrompt = userPrompt;

  // Ciclo di tentativi di validazione (1 iniziale + fino a 2 con feedback correttivo)
  for (let validationAttempt = 0; validationAttempt <= maxValidationRetries; validationAttempt++) {
    // Registra il timestamp di inizio per calcolo della latenza
    const startTime = Date.now();

    // Esegue l'invocazione con gestione retry per throttling
    const rawText = await invokeWithThrottlingRetry(
      client,
      config.bedrockModelId,
      systemPrompt,
      currentUserPrompt,
      config.bedrockTimeoutMs,
    );

    // Calcola la latenza dell'invocazione
    const latencyMs = Date.now() - startTime;

    // Tenta il parsing JSON della risposta del modello
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText); // Parsing del testo JSON dalla risposta del modello
    } catch {
      // Se il parsing JSON fallisce, tratta come errore di validazione
      const jsonError = `Errore di parsing JSON: la risposta non è un JSON valido. Risposta ricevuta: ${rawText.slice(0, 200)}`;

      if (validationAttempt < maxValidationRetries) {
        // Ricostruisce il prompt con feedback correttivo includendo l'errore
        currentUserPrompt = buildCorrectiveFeedbackPrompt(userPrompt, jsonError);
        continue; // Ritenta con il feedback correttivo
      }
      // Tutti i tentativi esauriti, lancia l'errore finale
      throw new Error(
        `Validazione fallita dopo ${maxValidationRetries + 1} tentativi. Ultimo errore: ${jsonError}`,
      );
    }

    // Valida la risposta parsata contro lo schema Zod del pacchetto shared
    const validationResult = generatedQuestionDraftSchema.safeParse(parsed);

    if (validationResult.success) {
      // Logga le metriche di successo in formato JSON strutturato
      console.log(
        JSON.stringify({
          level: 'INFO',
          message: 'Invocazione Bedrock completata con successo',
          modelId: config.bedrockModelId,
          latencyMs,
          validationAttempt: validationAttempt + 1, // Numero del tentativo riuscito
        }),
      );
      return validationResult.data; // Restituisce il draft validato
    }

    // La validazione Zod è fallita: costruisce il messaggio di errore dettagliato
    const zodErrorDetails = validationResult.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');

    if (validationAttempt < maxValidationRetries) {
      // Ricostruisce il prompt con feedback correttivo includendo i dettagli dell'errore Zod
      currentUserPrompt = buildCorrectiveFeedbackPrompt(userPrompt, zodErrorDetails);
    } else {
      // Tutti i tentativi esauriti, lancia l'errore finale con i dettagli di validazione
      throw new Error(
        `Validazione fallita dopo ${maxValidationRetries + 1} tentativi. Ultimo errore Zod: ${zodErrorDetails}`,
      );
    }
  }

  // Caso non raggiungibile, ma TypeScript richiede un return esplicito
  throw new Error('Tentativi di validazione esauriti');
}

/**
 * Esegue una singola invocazione Bedrock con retry per errori di throttling.
 * Utilizza AbortController per imporre un timeout sulla richiesta.
 *
 * @param client - Istanza del client Bedrock Runtime
 * @param modelId - ID del modello Bedrock da invocare
 * @param systemPrompt - Prompt di sistema
 * @param userPrompt - Prompt utente
 * @param timeoutMs - Timeout in millisecondi per l'invocazione
 * @returns Il testo della risposta dal modello
 * @throws Errore se tutti i tentativi di throttling retry sono esauriti
 */
async function invokeWithThrottlingRetry(
  client: BedrockRuntimeClient,
  modelId: string,
  systemPrompt: string,
  userPrompt: string,
  timeoutMs: number,
): Promise<string> {
  let lastError: unknown;

  // Ciclo di retry per throttling: 1 tentativo iniziale + fino a 3 retry (basato su BEDROCK_RETRY_DELAYS_MS)
  for (let attempt = 0; attempt <= BEDROCK_RETRY_DELAYS_MS.length; attempt++) {
    try {
      // Crea un AbortController per imporre il timeout sulla singola invocazione
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), timeoutMs);

      try {
        // Costruisce e invia il comando Converse con i parametri di inferenza
        const command = new ConverseCommand({
          modelId,
          system: [{ text: systemPrompt }], // Istruzioni di sistema per il modello
          messages: [{ role: 'user', content: [{ text: userPrompt }] }], // Messaggio utente
          inferenceConfig: {
            temperature: 0.4, // Temperatura bassa per risposte più deterministiche
            maxTokens: 1400, // Numero massimo di token nella risposta
          },
        });

        // Invia il comando con il segnale di abort per il timeout
        const response = await client.send(command, {
          abortSignal: abortController.signal,
        });

        // Cancella il timer di timeout dopo la risposta ricevuta
        clearTimeout(timeoutId);

        // Logga le metriche di utilizzo token se disponibili
        const inputTokens = response.usage?.inputTokens ?? 0;
        const outputTokens = response.usage?.outputTokens ?? 0;
        console.log(
          JSON.stringify({
            level: 'INFO',
            message: 'Metriche token Bedrock',
            modelId,
            inputTokens,
            outputTokens,
          }),
        );

        // Estrae il testo dalla risposta del modello
        const content = response.output?.message?.content as Array<{ text?: string }> | undefined;
        return extractTextFromResponse(content);
      } catch (error) {
        // Cancella il timer di timeout in caso di errore
        clearTimeout(timeoutId);
        throw error; // Rilancia per la gestione nel blocco esterno
      }
    } catch (error) {
      lastError = error;

      // Se non è un errore di throttling o abbiamo esaurito i retry, interrompe il ciclo
      if (!isThrottlingError(error) || attempt === BEDROCK_RETRY_DELAYS_MS.length) {
        break;
      }

      // Attende il ritardo di backoff prima del prossimo tentativo
      await sleep(BEDROCK_RETRY_DELAYS_MS[attempt]!);
    }
  }

  // Tutti i tentativi esauriti: lancia l'ultimo errore catturato
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

/**
 * Invoca il modello Bedrock tramite la Converse API restituendo la risposta grezza
 * senza alcuna validazione JSON o Zod. Utile per generare contenuti con schema
 * diverso da `generatedQuestionDraftSchema` (es. risposte arricchite study mode).
 *
 * Caratteristiche:
 * - Timeout configurabile tramite AbortController (riutilizza `invokeWithThrottlingRetry`)
 * - Retry con backoff esponenziale per ThrottlingException
 * - Logging strutturato della latenza dell'invocazione
 * - Nessun parsing JSON né validazione Zod della risposta
 *
 * @param systemPrompt - Il prompt di sistema per istruire il modello
 * @param userPrompt - Il prompt utente con la richiesta specifica
 * @param config - Configurazione applicativa con model ID e timeout
 * @returns La stringa grezza della risposta del modello
 * @throws Errore se l'invocazione fallisce dopo tutti i tentativi di retry
 */
export async function invokeModelRaw(
  systemPrompt: string,
  userPrompt: string,
  config: AppConfig,
): Promise<string> {
  // Istanza del client Bedrock Runtime per l'invocazione
  const client = new BedrockRuntimeClient({});

  // Registra il timestamp di inizio per calcolo della latenza
  const startTime = Date.now();

  // Invoca il modello con gestione retry per throttling e timeout
  const rawText = await invokeWithThrottlingRetry(
    client,
    config.bedrockModelId,
    systemPrompt,
    userPrompt,
    config.bedrockTimeoutMs,
  );

  // Calcola la latenza dell'invocazione in millisecondi
  const latencyMs = Date.now() - startTime;

  // Logga le metriche di invocazione in formato JSON strutturato
  console.log(
    JSON.stringify({
      level: 'INFO',
      message: 'Invocazione Bedrock grezza completata con successo',
      modelId: config.bedrockModelId,
      latencyMs,
    }),
  );

  // Restituisce la risposta grezza senza parsing né validazione
  return rawText;
}

/**
 * Costruisce un prompt con feedback correttivo per ritentare la generazione
 * dopo un errore di validazione della risposta.
 *
 * @param originalPrompt - Il prompt utente originale
 * @param errorDetails - Dettagli dell'errore di validazione (errori Zod o parsing JSON)
 * @returns Il nuovo prompt con istruzioni correttive
 */
function buildCorrectiveFeedbackPrompt(
  originalPrompt: string,
  errorDetails: string,
): string {
  // Aggiunge al prompt originale le istruzioni correttive con i dettagli dell'errore
  return `${originalPrompt}

---
FEEDBACK CORRETTIVO: La risposta precedente non ha superato la validazione.
Errori riscontrati: ${errorDetails}

Per favore, genera una nuova risposta in formato JSON valido che rispetti esattamente lo schema richiesto.
Assicurati che tutti i campi obbligatori siano presenti e rispettino i vincoli di lunghezza e formato.`;
}
