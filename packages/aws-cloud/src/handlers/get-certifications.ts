/**
 * Handler Lambda per l'endpoint GET /certifications.
 *
 * Restituisce il catalogo completo delle certificazioni AWS supportate,
 * raggruppate per livello (professional, associate, specialty).
 * Ogni certificazione include definizioni dei domini, distribuzione formati,
 * numero totale di domande, tempo limite e distribuzione topic opzionale.
 *
 * Endpoint pubblico: non richiede autenticazione (Requisito 11.6).
 *
 * Input: APIGatewayProxyEvent (nessun parametro richiesto)
 * Output: ApiGatewayResponse 200 con il catalogo certificazioni in JSON
 */

import type { APIGatewayProxyEvent } from 'aws-lambda'; // Tipo evento API Gateway
import { certificationRegistry } from '@aws-exam-generator/shared'; // Registro certificazioni condiviso
import { ok } from '../utils/response.js'; // Helper risposta 200 OK
import type { ApiGatewayResponse } from '../utils/response.js'; // Tipo risposta API Gateway
import { createLogger } from '../utils/logger.js'; // Factory per il logger strutturato

// Crea un'istanza del logger per questa funzione Lambda
const logger = createLogger('get-certifications');

/**
 * Handler principale per GET /certifications.
 * Recupera il catalogo completo dal registro certificazioni condiviso
 * e lo restituisce raggruppato per livello con tutti i dettagli.
 *
 * @param event - Evento API Gateway contenente la richiesta HTTP
 * @returns Risposta 200 con il catalogo certificazioni completo
 */
export async function handler(event: APIGatewayProxyEvent): Promise<ApiGatewayResponse> {
  // Imposta il requestId di correlazione dal contesto API Gateway
  logger.setRequestId(event.requestContext?.requestId ?? 'unknown');

  // Log dell'invocazione dell'endpoint
  logger.info('Richiesta catalogo certificazioni ricevuta');

  // Recupera tutte le certificazioni raggruppate per livello dal registro condiviso
  const catalogoPerLivello = certificationRegistry.getAll();

  // Log del numero di certificazioni restituite per ogni livello
  logger.info('Catalogo certificazioni recuperato con successo', {
    professional: catalogoPerLivello.professional.length, // Numero certificazioni professionali
    associate: catalogoPerLivello.associate.length, // Numero certificazioni associate
    specialty: catalogoPerLivello.specialty.length, // Numero certificazioni specialistiche
  });

  // Restituisce la risposta 200 OK con il catalogo completo
  return ok(catalogoPerLivello);
}
