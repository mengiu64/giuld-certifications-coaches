/**
 * Modulo per il caricamento della configurazione da AWS SSM Parameter Store.
 *
 * Funzioni pubbliche:
 * - `loadConfig(env)`: carica i parametri SSM per l'ambiente specificato,
 *   con caching in memoria (una sola lettura per cold start) e fallback
 *   ai valori di default dal pacchetto shared in caso di errore.
 *
 * Tipi esportati:
 * - `AppConfig`: interfaccia con i campi di configurazione dell'applicazione.
 */

import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm'; // Importa il client SSM e il comando GetParameter
import {
  BEDROCK_INTER_REQUEST_DELAY_MS,
} from '@aws-exam-generator/shared'; // Importa le costanti di default dal pacchetto condiviso

// Interfaccia per la configurazione dell'applicazione
export interface AppConfig {
  bedrockModelId: string; // ID del modello Bedrock da utilizzare
  bedrockTimeoutMs: number; // Timeout in millisecondi per le invocazioni Bedrock
  interRequestDelayMs: number; // Ritardo in millisecondi tra le richieste successive
  apiRateLimitRps: number; // Limite di richieste al secondo per l'API
}

// Valori di default utilizzati in caso di errore nel recupero da SSM
const DEFAULT_CONFIG: AppConfig = {
  bedrockModelId: 'anthropic.claude-3-sonnet-20240229-v1:0', // Modello Claude di default
  bedrockTimeoutMs: 30000, // Timeout di 30 secondi di default
  interRequestDelayMs: BEDROCK_INTER_REQUEST_DELAY_MS, // Ritardo inter-richiesta dal pacchetto shared (2000ms)
  apiRateLimitRps: 100, // Limite di 100 richieste al secondo di default
};

// Cache in memoria per la configurazione (caricata una sola volta per cold start)
let cachedConfig: AppConfig | null = null;

// Istanza del client SSM (riutilizzata tra le invocazioni)
const ssmClient = new SSMClient({});

/**
 * Legge un singolo parametro da SSM Parameter Store.
 *
 * @param path - Percorso completo del parametro SSM
 * @returns Il valore del parametro come stringa, oppure null se non trovato o in caso di errore
 */
async function getParameter(path: string): Promise<string | null> {
  try {
    // Esegue la richiesta GetParameter verso SSM
    const command = new GetParameterCommand({
      Name: path, // Percorso del parametro da recuperare
      WithDecryption: true, // Decrittografa i parametri di tipo SecureString
    });
    const response = await ssmClient.send(command); // Invia il comando al servizio SSM
    return response.Parameter?.Value ?? null; // Restituisce il valore o null se assente
  } catch (error) {
    // Logga l'errore con il percorso del parametro che ha fallito
    console.error(
      `[SSM] Errore nel recupero del parametro: ${path}`,
      error instanceof Error ? error.message : error,
    );
    return null; // Restituisce null per attivare il fallback al valore di default
  }
}

/**
 * Carica la configurazione dell'applicazione da SSM Parameter Store.
 *
 * Implementa caching in memoria: al primo invocazione (cold start) legge i parametri SSM,
 * nelle invocazioni successive restituisce la configurazione già in cache.
 * In caso di errore nel recupero di un parametro, utilizza il valore di default
 * definito nel pacchetto @aws-exam-generator/shared.
 *
 * @param env - Nome dell'ambiente di deployment (dev, staging, prod)
 * @returns La configurazione dell'applicazione con i valori da SSM o i default
 */
export async function loadConfig(env: string): Promise<AppConfig> {
  // Se la configurazione è già in cache, la restituisce immediatamente
  if (cachedConfig !== null) {
    return cachedConfig; // Riutilizza la configurazione caricata durante il cold start
  }

  // Costruisce il prefisso del percorso SSM per l'ambiente specificato
  const prefix = `/aws-exam-generator/${env}`; // Prefisso comune per tutti i parametri

  // Recupera i quattro parametri SSM in parallelo per ridurre la latenza
  const [modelId, timeoutMs, delayMs, rateLimitRps] = await Promise.all([
    getParameter(`${prefix}/bedrock-model-id`), // Parametro: ID del modello Bedrock
    getParameter(`${prefix}/bedrock-timeout-ms`), // Parametro: timeout delle invocazioni Bedrock
    getParameter(`${prefix}/inter-request-delay-ms`), // Parametro: ritardo tra le richieste
    getParameter(`${prefix}/api-rate-limit-rps`), // Parametro: limite di richieste al secondo
  ]);

  // Costruisce la configurazione con fallback ai valori di default per ogni parametro mancante
  const config: AppConfig = {
    bedrockModelId: modelId ?? DEFAULT_CONFIG.bedrockModelId, // Usa il valore SSM o il default
    bedrockTimeoutMs: timeoutMs !== null ? parseInt(timeoutMs, 10) : DEFAULT_CONFIG.bedrockTimeoutMs, // Converte la stringa in numero o usa il default
    interRequestDelayMs: delayMs !== null ? parseInt(delayMs, 10) : DEFAULT_CONFIG.interRequestDelayMs, // Converte la stringa in numero o usa il default
    apiRateLimitRps: rateLimitRps !== null ? parseInt(rateLimitRps, 10) : DEFAULT_CONFIG.apiRateLimitRps, // Converte la stringa in numero o usa il default
  };

  // Salva la configurazione in cache per le invocazioni successive (warm start)
  cachedConfig = config;

  return config; // Restituisce la configurazione caricata
}

/**
 * Resetta la cache della configurazione.
 * Utilizzato solo per i test per garantire isolamento tra i casi di test.
 */
export function _resetConfigCache(): void {
  cachedConfig = null; // Svuota la cache per forzare un nuovo caricamento da SSM
}
