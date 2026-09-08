/**
 * Modulo di utility per le risposte API Gateway.
 * Fornisce funzioni helper per costruire risposte HTTP standardizzate
 * con gli header CORS corretti per tutte le Lambda functions.
 *
 * Funzioni pubbliche:
 * - ok(body): risposta 200 con corpo JSON
 * - created(body): risposta 201 con corpo JSON
 * - accepted(body): risposta 202 con corpo JSON
 * - badRequest(message): risposta 400 con messaggio di errore
 * - unauthorized(): risposta 401 senza autenticazione
 * - notFound(message): risposta 404 risorsa non trovata
 * - conflict(message): risposta 409 conflitto
 * - tooManyRequests(): risposta 429 limite di frequenza superato
 * - internalError(): risposta 500 errore interno del server
 *
 * Input: corpo della risposta (oggetto) o messaggio di errore (stringa)
 * Output: ApiGatewayResponse con statusCode, headers CORS e body serializzato
 */

// Interfaccia per la risposta API Gateway Lambda
export interface ApiGatewayResponse {
  statusCode: number; // Codice di stato HTTP della risposta
  headers: Record<string, string>; // Header HTTP inclusi CORS
  body: string; // Corpo della risposta serializzato come JSON
}

// Header CORS predefiniti per tutte le risposte API Gateway
const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*', // Permette richieste da qualsiasi origine
  'Access-Control-Allow-Headers': 'Content-Type, Authorization', // Header permessi nelle richieste
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', // Metodi HTTP permessi
  'Content-Type': 'application/json', // Tipo di contenuto della risposta
};

/**
 * Costruisce un oggetto risposta API Gateway con gli header CORS.
 * Funzione interna utilizzata da tutti gli helper pubblici.
 *
 * @param statusCode - Codice di stato HTTP
 * @param body - Corpo della risposta già serializzato come stringa JSON
 * @returns ApiGatewayResponse completa con header CORS
 */
// Funzione helper per costruire la risposta con header CORS
const buildResponse = (statusCode: number, body: string): ApiGatewayResponse => ({
  statusCode, // Imposta il codice di stato HTTP
  headers: { ...corsHeaders }, // Copia gli header CORS nella risposta
  body, // Imposta il corpo della risposta serializzato
});

/**
 * Restituisce una risposta 200 OK con il corpo serializzato come JSON.
 * Utilizzata per operazioni di lettura completate con successo.
 *
 * @param body - Oggetto da serializzare nel corpo della risposta
 * @returns ApiGatewayResponse con statusCode 200
 */
// Risposta 200 OK con corpo JSON
export const ok = (body: unknown): ApiGatewayResponse =>
  buildResponse(200, JSON.stringify(body)); // Serializza il corpo e costruisce la risposta

/**
 * Restituisce una risposta 201 Created con il corpo serializzato come JSON.
 * Utilizzata quando una nuova risorsa è stata creata con successo.
 *
 * @param body - Oggetto da serializzare nel corpo della risposta
 * @returns ApiGatewayResponse con statusCode 201
 */
// Risposta 201 Created con corpo JSON
export const created = (body: unknown): ApiGatewayResponse =>
  buildResponse(201, JSON.stringify(body)); // Serializza il corpo e costruisce la risposta

/**
 * Restituisce una risposta 202 Accepted con il corpo serializzato come JSON.
 * Utilizzata quando una richiesta è stata accettata per elaborazione asincrona.
 *
 * @param body - Oggetto da serializzare nel corpo della risposta
 * @returns ApiGatewayResponse con statusCode 202
 */
// Risposta 202 Accepted con corpo JSON
export const accepted = (body: unknown): ApiGatewayResponse =>
  buildResponse(202, JSON.stringify(body)); // Serializza il corpo e costruisce la risposta

/**
 * Restituisce una risposta 400 Bad Request con messaggio di errore.
 * Utilizzata quando la richiesta del client è invalida o malformata.
 *
 * @param message - Messaggio descrittivo dell'errore di validazione
 * @returns ApiGatewayResponse con statusCode 400
 */
// Risposta 400 Bad Request con messaggio di errore
export const badRequest = (message: string): ApiGatewayResponse =>
  buildResponse(400, JSON.stringify({ message })); // Serializza il messaggio di errore

/**
 * Restituisce una risposta 401 Unauthorized senza corpo dettagliato.
 * Utilizzata quando la richiesta non include credenziali valide.
 *
 * @returns ApiGatewayResponse con statusCode 401
 */
// Risposta 401 Unauthorized per richieste non autenticate
export const unauthorized = (): ApiGatewayResponse =>
  buildResponse(401, JSON.stringify({ message: 'Unauthorized' })); // Messaggio generico di non autorizzazione

/**
 * Restituisce una risposta 404 Not Found con messaggio di errore.
 * Utilizzata quando la risorsa richiesta non esiste nel sistema.
 *
 * @param message - Messaggio descrittivo della risorsa non trovata
 * @returns ApiGatewayResponse con statusCode 404
 */
// Risposta 404 Not Found per risorse non trovate
export const notFound = (message: string): ApiGatewayResponse =>
  buildResponse(404, JSON.stringify({ message })); // Serializza il messaggio di risorsa non trovata

/**
 * Restituisce una risposta 409 Conflict con messaggio di errore.
 * Utilizzata quando l'operazione è in conflitto con lo stato attuale della risorsa.
 *
 * @param message - Messaggio descrittivo del conflitto
 * @returns ApiGatewayResponse con statusCode 409
 */
// Risposta 409 Conflict per conflitti di stato
export const conflict = (message: string): ApiGatewayResponse =>
  buildResponse(409, JSON.stringify({ message })); // Serializza il messaggio di conflitto

/**
 * Restituisce una risposta 429 Too Many Requests.
 * Utilizzata quando il client ha superato il limite di frequenza delle richieste.
 *
 * @returns ApiGatewayResponse con statusCode 429
 */
// Risposta 429 Too Many Requests per superamento del limite di frequenza
export const tooManyRequests = (): ApiGatewayResponse =>
  buildResponse(429, JSON.stringify({ message: 'Rate limit exceeded.' })); // Messaggio di limite superato

/**
 * Restituisce una risposta 500 Internal Server Error.
 * Utilizzata quando si verifica un errore interno non previsto nel server.
 *
 * @returns ApiGatewayResponse con statusCode 500
 */
// Risposta 500 Internal Server Error per errori interni del server
export const internalError = (): ApiGatewayResponse =>
  buildResponse(500, JSON.stringify({ message: 'Internal server error.' })); // Messaggio generico di errore interno
