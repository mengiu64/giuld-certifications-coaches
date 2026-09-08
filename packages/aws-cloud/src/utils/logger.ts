/**
 * Modulo di logging strutturato per le Lambda function.
 *
 * Fornisce un logger che emette JSON strutturato su CloudWatch,
 * con supporto per la redazione di campi sensibili e
 * l'iniezione automatica del requestId come correlation ID.
 *
 * Metodi pubblici:
 * - createLogger(functionName): crea un'istanza logger per la funzione specificata
 * - setRequestId(id): imposta il requestId di correlazione per la richiesta corrente
 * - info(message, metadata?): log a livello INFO
 * - warn(message, metadata?): log a livello WARN
 * - error(message, metadata?): log a livello ERROR
 */

// Pattern per identificare chiavi contenenti dati sensibili
const SENSITIVE_KEY_PATTERNS = /password|token|secret|authorization|accesskey/i;

// Placeholder utilizzato per sostituire valori sensibili
const REDACTED_PLACEHOLDER = '[REDACTED]';

/**
 * Interfaccia per una singola voce di log strutturato.
 * Rappresenta il formato JSON emesso su CloudWatch.
 */
export interface StructuredLogEntry {
  // Timestamp in formato ISO 8601
  timestamp: string;
  // ID della richiesta API Gateway per correlazione distribuita
  requestId: string;
  // Nome della funzione Lambda che ha generato il log
  functionName: string;
  // Livello di severità del log
  level: 'INFO' | 'WARN' | 'ERROR';
  // Messaggio descrittivo dell'evento loggato
  message: string;
  // Metadati aggiuntivi relativi all'operazione
  metadata: Record<string, unknown>;
}

/**
 * Interfaccia pubblica del logger strutturato.
 * Espone metodi per i tre livelli di log e per impostare il requestId.
 */
export interface Logger {
  // Imposta il requestId di correlazione per la richiesta corrente
  setRequestId(id: string): void;
  // Emette un log a livello INFO
  info(message: string, metadata?: Record<string, unknown>): void;
  // Emette un log a livello WARN
  warn(message: string, metadata?: Record<string, unknown>): void;
  // Emette un log a livello ERROR
  error(message: string, metadata?: Record<string, unknown>): void;
}

/**
 * Verifica se una chiave corrisponde a un pattern di campo sensibile.
 * Restituisce true se la chiave contiene password, token, secret, authorization o accessKey.
 */
function isSensitiveKey(key: string): boolean {
  // Confronta la chiave con i pattern di campi sensibili
  return SENSITIVE_KEY_PATTERNS.test(key);
}

/**
 * Redige ricorsivamente i valori dei campi sensibili in un oggetto.
 * I campi con chiavi corrispondenti ai pattern sensibili vengono sostituiti
 * con il placeholder [REDACTED], preservando tutti gli altri campi.
 */
export function redactSensitiveFields(obj: Record<string, unknown>): Record<string, unknown> {
  // Crea un nuovo oggetto per non mutare l'originale
  const redacted: Record<string, unknown> = {};

  // Itera su tutte le chiavi dell'oggetto
  for (const key of Object.keys(obj)) {
    // Ottiene il valore corrente per la chiave
    const value = obj[key];

    // Controlla se la chiave corrisponde a un campo sensibile
    if (isSensitiveKey(key)) {
      // Sostituisce il valore con il placeholder di redazione
      redacted[key] = REDACTED_PLACEHOLDER;
    } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      // Applica la redazione ricorsivamente agli oggetti annidati
      redacted[key] = redactSensitiveFields(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      // Applica la redazione ricorsivamente agli elementi array che sono oggetti
      redacted[key] = value.map((item) =>
        item !== null && typeof item === 'object' && !Array.isArray(item)
          ? redactSensitiveFields(item as Record<string, unknown>)
          : item
      );
    } else {
      // Preserva il valore originale per campi non sensibili
      redacted[key] = value;
    }
  }

  // Restituisce l'oggetto con i campi sensibili redatti
  return redacted;
}

/**
 * Factory che crea un'istanza di logger strutturato per una specifica funzione Lambda.
 * Il logger emette JSON su console con redazione automatica dei campi sensibili
 * e iniezione del requestId come correlation ID.
 *
 * @param functionName - Nome della funzione Lambda che utilizza il logger
 * @returns Istanza del logger con metodi info, warn, error e setRequestId
 */
export function createLogger(functionName: string): Logger {
  // Variabile che mantiene il requestId corrente per la correlazione
  let currentRequestId = 'unknown';

  /**
   * Costruisce e emette una voce di log strutturato.
   * Applica la redazione dei campi sensibili prima dell'emissione.
   */
  function emit(level: 'INFO' | 'WARN' | 'ERROR', message: string, metadata: Record<string, unknown> = {}): void {
    // Applica la redazione ai metadati forniti
    const safeMetadata = redactSensitiveFields(metadata);

    // Costruisce la voce di log strutturato completa
    const entry: StructuredLogEntry = {
      // Genera il timestamp corrente in formato ISO 8601
      timestamp: new Date().toISOString(),
      // Inietta il requestId corrente come correlation ID
      requestId: currentRequestId,
      // Include il nome della funzione Lambda
      functionName,
      // Imposta il livello di severità
      level,
      // Include il messaggio descrittivo
      message,
      // Include i metadati redatti
      metadata: safeMetadata,
    };

    // Serializza la voce come JSON ed emette sul canale appropriato
    const jsonEntry = JSON.stringify(entry);

    // Seleziona il metodo console corrispondente al livello di log
    if (level === 'ERROR') {
      // Emette su stderr per gli errori
      console.error(jsonEntry);
    } else if (level === 'WARN') {
      // Emette come warning per gli avvisi
      console.warn(jsonEntry);
    } else {
      // Emette su stdout per i messaggi informativi
      console.log(jsonEntry);
    }
  }

  // Restituisce l'interfaccia pubblica del logger
  return {
    setRequestId(id: string): void {
      // Aggiorna il requestId di correlazione per le successive emissioni
      currentRequestId = id;
    },

    info(message: string, metadata?: Record<string, unknown>): void {
      // Emette un log a livello INFO
      emit('INFO', message, metadata);
    },

    warn(message: string, metadata?: Record<string, unknown>): void {
      // Emette un log a livello WARN
      emit('WARN', message, metadata);
    },

    error(message: string, metadata?: Record<string, unknown>): void {
      // Emette un log a livello ERROR
      emit('ERROR', message, metadata);
    },
  };
}
