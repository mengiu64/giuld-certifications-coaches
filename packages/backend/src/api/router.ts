import express from 'express';
import { z } from 'zod';
import { DEFAULT_CERTIFICATION_ID, questionSchema } from '@aws-exam-generator/shared';
import { certificationRegistry } from '@aws-exam-generator/shared';
import { ExamAgentController } from '../agent/ExamAgentController.js';
import { QuestionBankManager } from '../agent/QuestionBankManager.js';

const generationRequestSchema = z.object({
  certificationId: z.string().optional(),
});

const bankIdParamSchema = z.object({
  bankId: z.string().uuid(),
});

const certQuerySchema = z.object({
  cert: z.string().optional(),
  certificationId: z.string().optional(),
});

const parseRequest = <T>(schema: z.ZodType<T>, input: unknown): T => schema.parse(input);

export const createRouter = (
  questionBankManager: QuestionBankManager,
  examAgentController: ExamAgentController,
): express.Router => {
  const router = express.Router();

  router.get('/certifications', (_request, response) => {
    response.json(certificationRegistry.getAll());
  });

  router.post('/exams/generate', async (request, response) => {
    try {
      const payload = parseRequest(generationRequestSchema, request.body ?? {});
      const status = await examAgentController.startGeneration(payload.certificationId);
      response.status(202).json(status);
    } catch (error) {
      if (error instanceof Error && error.name === 'ConflictError') {
        response.status(409).json({ message: error.message });
        return;
      }
      if (error instanceof z.ZodError || (error instanceof Error && error.name === 'ValidationError')) {
        response.status(400).json({ message: error instanceof Error ? error.message : 'Invalid request payload.' });
        return;
      }
      response.status(500).json({ message: error instanceof Error ? error.message : 'Unexpected error.' });
    }
  });

  router.get('/exams/generate/status', (_request, response) => {
    response.json(examAgentController.getStatus());
  });

  router.get('/banks', async (_request, response) => {
    response.json(await questionBankManager.listBanks());
  });

  router.get('/banks/:bankId', async (request, response) => {
    try {
      const { bankId } = parseRequest(bankIdParamSchema, request.params);
      const bank = await questionBankManager.getBank(bankId);
      if (!bank) {
        response.status(404).json({ message: `Bank ${bankId} not found.` });
        return;
      }
      response.json(bank);
    } catch (error) {
      response.status(400).json({ message: error instanceof Error ? error.message : 'Invalid bank identifier.' });
    }
  });

  router.post('/questions', async (request, response) => {
    try {
      const query = parseRequest(certQuerySchema, request.query);
      const certificationId = query.cert ?? query.certificationId ?? DEFAULT_CERTIFICATION_ID;
      const question = questionSchema.parse(request.body);
      const saved = await questionBankManager.saveQuestion(question, certificationId);
      response.status(201).json(saved);
    } catch (error) {
      response.status(400).json({ message: error instanceof Error ? error.message : 'Invalid question payload.' });
    }
  });

  router.get('/questions', async (request, response) => {
    try {
      const query = parseRequest(certQuerySchema, request.query);
      const certificationId = query.cert ?? query.certificationId ?? DEFAULT_CERTIFICATION_ID;
      response.json(await questionBankManager.getLatestQuestions(certificationId));
    } catch (error) {
      response.status(400).json({ message: error instanceof Error ? error.message : 'Invalid certification.' });
    }
  });

  return router;
};
