import { describe, it, expect } from 'vitest';
import {
  ok,
  created,
  accepted,
  badRequest,
  unauthorized,
  notFound,
  conflict,
  tooManyRequests,
  internalError,
  type ApiGatewayResponse,
} from '../../src/utils/response.js';

// Header CORS attesi in tutte le risposte
const expectedCorsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json',
};

// Funzione helper per verificare gli header CORS
const assertCorsHeaders = (response: ApiGatewayResponse) => {
  expect(response.headers).toEqual(expectedCorsHeaders);
};

describe('API Gateway Response Helpers', () => {
  describe('ok', () => {
    it('restituisce 200 con il corpo serializzato', () => {
      const body = { data: 'test', count: 42 };
      const response = ok(body);

      expect(response.statusCode).toBe(200);
      expect(response.body).toBe(JSON.stringify(body));
      assertCorsHeaders(response);
    });

    it('gestisce correttamente un corpo vuoto', () => {
      const response = ok({});

      expect(response.statusCode).toBe(200);
      expect(response.body).toBe('{}');
      assertCorsHeaders(response);
    });
  });

  describe('created', () => {
    it('restituisce 201 con il corpo serializzato', () => {
      const body = { id: 'abc-123', name: 'nuovo elemento' };
      const response = created(body);

      expect(response.statusCode).toBe(201);
      expect(response.body).toBe(JSON.stringify(body));
      assertCorsHeaders(response);
    });
  });

  describe('accepted', () => {
    it('restituisce 202 con il corpo serializzato', () => {
      const body = { executionId: 'exec-456' };
      const response = accepted(body);

      expect(response.statusCode).toBe(202);
      expect(response.body).toBe(JSON.stringify(body));
      assertCorsHeaders(response);
    });
  });

  describe('badRequest', () => {
    it('restituisce 400 con il messaggio di errore', () => {
      const message = 'Campo certificationId mancante';
      const response = badRequest(message);

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body)).toEqual({ message });
      assertCorsHeaders(response);
    });
  });

  describe('unauthorized', () => {
    it('restituisce 401 con messaggio Unauthorized', () => {
      const response = unauthorized();

      expect(response.statusCode).toBe(401);
      expect(JSON.parse(response.body)).toEqual({ message: 'Unauthorized' });
      assertCorsHeaders(response);
    });
  });

  describe('notFound', () => {
    it('restituisce 404 con il messaggio di errore', () => {
      const message = 'Bank bank-xyz not found.';
      const response = notFound(message);

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.body)).toEqual({ message });
      assertCorsHeaders(response);
    });
  });

  describe('conflict', () => {
    it('restituisce 409 con il messaggio di errore', () => {
      const message = 'A generation job is already running.';
      const response = conflict(message);

      expect(response.statusCode).toBe(409);
      expect(JSON.parse(response.body)).toEqual({ message });
      assertCorsHeaders(response);
    });
  });

  describe('tooManyRequests', () => {
    it('restituisce 429 con messaggio di limite superato', () => {
      const response = tooManyRequests();

      expect(response.statusCode).toBe(429);
      expect(JSON.parse(response.body)).toEqual({ message: 'Rate limit exceeded.' });
      assertCorsHeaders(response);
    });
  });

  describe('internalError', () => {
    it('restituisce 500 con messaggio di errore interno', () => {
      const response = internalError();

      expect(response.statusCode).toBe(500);
      expect(JSON.parse(response.body)).toEqual({ message: 'Internal server error.' });
      assertCorsHeaders(response);
    });
  });
});
