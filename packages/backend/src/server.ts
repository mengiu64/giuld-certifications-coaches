import cors from 'cors';
import express from 'express';
import { createRouter } from './api/router.js';
import { ExamAgentController } from './agent/ExamAgentController.js';
import { QualityPipeline } from './agent/QualityPipeline.js';
import { QuestionBankManager } from './agent/QuestionBankManager.js';
import { QuestionGenerator } from './agent/QuestionGenerator.js';
import { env } from './config/env.js';
import { TopicConfigLoader } from './config/topic-config-loader.js';
import { McpClient } from './mcp/McpClient.js';
import { BedrockClient } from './services/BedrockClient.js';
import { certificationRegistry } from '@aws-exam-generator/shared';

export const createApp = () => {
  const app = express();
  const mcpClient = new McpClient(env.mcpServerCommand, [...env.mcpServerArgs]);
  const bedrockClient = new BedrockClient(env.awsRegion, env.awsProfile, env.bedrockModelId);
  const questionBankManager = new QuestionBankManager(env.questionBanksDir, certificationRegistry);
  const questionGenerator = new QuestionGenerator(bedrockClient, mcpClient, env.bedrockMockFallback);
  const qualityPipeline = new QualityPipeline({
    noveltyEnabled: env.qualityNoveltyEnabled,
    stemSimilarityThreshold: env.qualityStemSimilarityThreshold,
    explanationSimilarityThreshold: env.qualityExplanationSimilarityThreshold,
    qualityRetryLimit: env.qualityRetryLimit,
    styleRepetitionWindow: env.qualityStyleWindow,
  });
  const examAgentController = new ExamAgentController(
    questionGenerator,
    questionBankManager,
    certificationRegistry,
    env.checkpointFilePath,
    qualityPipeline,
  );

  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.use('/api', createRouter(questionBankManager, examAgentController));
  app.get('/health', (_request, response) => {
    response.json({ status: 'ok' });
  });

  return { app, mcpClient };
};

TopicConfigLoader.load(env.topicConfigPath, certificationRegistry);

const { app, mcpClient } = createApp();
const server = app.listen(env.backendPort, () => {
  console.log(`AWS Exam Generator backend listening on port ${env.backendPort}`);
});

const shutdown = async (): Promise<void> => {
  await mcpClient.close().catch(() => undefined);
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
};

process.on('SIGINT', () => {
  void shutdown().finally(() => process.exit(0));
});
process.on('SIGTERM', () => {
  void shutdown().finally(() => process.exit(0));
});
