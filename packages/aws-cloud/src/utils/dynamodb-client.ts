/**
 * Modulo client DynamoDB con retry e generazione chiavi.
 *
 * Fornisce un singleton DynamoDBDocumentClient con configurazione retry,
 * funzioni per generare chiavi di partizione/ordinamento secondo il design single-table,
 * e wrapper generici per operazioni CRUD con backoff esponenziale.
 *
 * Metodi pubblici:
 * - bankKey(certId, bankId): genera chiavi per question bank
 * - sessionKey(sessionId): genera chiavi per sessione esame
 * - resultKey(sessionId): genera chiavi per risultato esame
 * - checkpointKey(certId, execId): genera chiavi per checkpoint generazione
 * - chunkKey(certId, bankId, index): genera chiavi per chunk di bank
 * - putWithRetry(item): scrittura con retry esponenziale
 * - getItem(key): lettura singolo elemento
 * - queryItems(params): query con parametri personalizzati
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb'; // Importa il client base DynamoDB
import { // Importa il document client e i comandi
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import type { // Importa i tipi per i comandi
  PutCommandInput,
  GetCommandInput,
  QueryCommandInput,
  QueryCommandOutput,
} from '@aws-sdk/lib-dynamodb';

// Nome della tabella DynamoDB dall'ambiente
const TABLE_NAME = process.env.TABLE_NAME ?? 'aws-exam-generator'; // Fallback al nome di default

// Configurazione dei ritardi per il backoff esponenziale (in millisecondi)
const RETRY_DELAYS_MS = [100, 200, 400] as const; // 3 tentativi con backoff crescente

// Creazione del client base DynamoDB con configurazione retry
const ddbClient = new DynamoDBClient({
  maxAttempts: 3, // Numero massimo di tentativi SDK-level
});

// Creazione del Document Client singleton con marshalling semplificato
export const docClient = DynamoDBDocumentClient.from(ddbClient, {
  marshallOptions: {
    removeUndefinedValues: true, // Rimuove valori undefined durante la serializzazione
  },
});

// --- Funzioni di generazione chiavi ---

/**
 * Genera la coppia di chiavi per una question bank.
 * Pattern: pk = BANK#<certId>, sk = BANK#<bankId>
 */
export function bankKey(certId: string, bankId: string): { pk: string; sk: string } {
  return { pk: `BANK#${certId}`, sk: `BANK#${bankId}` }; // Chiavi per entità question bank
}

/**
 * Genera la coppia di chiavi per una sessione esame.
 * Pattern: pk = SESSION#<sessionId>, sk = SESSION#<sessionId>
 */
export function sessionKey(sessionId: string): { pk: string; sk: string } {
  return { pk: `SESSION#${sessionId}`, sk: `SESSION#${sessionId}` }; // Chiavi per entità sessione
}

/**
 * Genera la coppia di chiavi per un risultato esame.
 * Pattern: pk = RESULT#<sessionId>, sk = RESULT#<sessionId>
 */
export function resultKey(sessionId: string): { pk: string; sk: string } {
  return { pk: `RESULT#${sessionId}`, sk: `RESULT#${sessionId}` }; // Chiavi per entità risultato
}

/**
 * Genera la coppia di chiavi per un checkpoint di generazione.
 * Pattern: pk = CHECKPOINT#<certId>, sk = EXEC#<execId>
 */
export function checkpointKey(certId: string, execId: string): { pk: string; sk: string } {
  return { pk: `CHECKPOINT#${certId}`, sk: `EXEC#${execId}` }; // Chiavi per entità checkpoint
}

/**
 * Genera la coppia di chiavi per un chunk di question bank.
 * Pattern: pk = BANK#<certId>#<bankId>, sk = CHUNK#<index>
 */
export function chunkKey(certId: string, bankId: string, index: number): { pk: string; sk: string } {
  return { pk: `BANK#${certId}#${bankId}`, sk: `CHUNK#${index}` }; // Chiavi per entità chunk
}

// --- Wrapper CRUD con retry ---

/**
 * Funzione di utilità per attendere un determinato periodo.
 * Usata internamente per il backoff esponenziale tra i tentativi.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms)); // Pausa asincrona
}

/**
 * Scrive un elemento in DynamoDB con retry e backoff esponenziale.
 * Esegue fino a 3 tentativi con ritardi di 100ms, 200ms, 400ms.
 *
 * @param item - L'elemento da scrivere nella tabella
 * @throws Error se tutti i tentativi falliscono
 */
export async function putWithRetry(item: Record<string, unknown>): Promise<void> {
  const params: PutCommandInput = { // Parametri per il comando Put
    TableName: TABLE_NAME, // Nome tabella dall'ambiente
    Item: item, // Elemento da persistere
  };

  let lastError: unknown; // Ultimo errore incontrato

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) { // Ciclo tentativi
    try {
      await docClient.send(new PutCommand(params)); // Invio comando Put
      return; // Scrittura riuscita, uscita immediata
    } catch (error) {
      lastError = error; // Salva l'errore per eventuale rilancio

      if (attempt < RETRY_DELAYS_MS.length) { // Se ci sono ancora tentativi disponibili
        const delay = RETRY_DELAYS_MS[attempt] as number; // Ritardo per il tentativo corrente
        await sleep(delay); // Attesa con backoff esponenziale
      }
    }
  }

  // Tutti i tentativi esauriti, rilancia l'ultimo errore
  throw lastError;
}

/**
 * Legge un singolo elemento da DynamoDB tramite chiave primaria.
 *
 * @param key - La chiave primaria (pk + sk) dell'elemento
 * @returns L'elemento trovato oppure undefined se non esiste
 */
export async function getItem(
  key: Record<string, string>
): Promise<Record<string, unknown> | undefined> {
  const params: GetCommandInput = { // Parametri per il comando Get
    TableName: TABLE_NAME, // Nome tabella dall'ambiente
    Key: key, // Chiave primaria dell'elemento
  };

  const result = await docClient.send(new GetCommand(params)); // Invio comando Get
  return result.Item as Record<string, unknown> | undefined; // Restituzione elemento o undefined
}

/**
 * Esegue una query su DynamoDB con i parametri forniti.
 * Aggiunge automaticamente il TableName se non specificato.
 *
 * @param params - Parametri della query (KeyConditionExpression, ecc.)
 * @returns Array degli elementi corrispondenti alla query
 */
export async function queryItems(
  params: Omit<QueryCommandInput, 'TableName'> & { TableName?: string }
): Promise<Record<string, unknown>[]> {
  const queryParams: QueryCommandInput = { // Parametri completi per il comando Query
    TableName: params.TableName ?? TABLE_NAME, // Usa tabella specificata o default
    ...params, // Spread degli altri parametri di query
  };

  const result: QueryCommandOutput = await docClient.send(new QueryCommand(queryParams)); // Invio comando Query
  return (result.Items ?? []) as Record<string, unknown>[]; // Restituzione elementi o array vuoto
}
