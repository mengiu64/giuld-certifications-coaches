import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { CHECKPOINT_FILE_NAME, DEFAULT_API_PORT, QUESTION_BANKS_DIR } from '@aws-exam-generator/shared';

dotenv.config();

const currentFilePath = fileURLToPath(import.meta.url);
const packageRoot = path.resolve(path.dirname(currentFilePath), '../..');
const repositoryRoot = path.resolve(packageRoot, '../..');
const questionBanksDir = path.resolve(repositoryRoot, QUESTION_BANKS_DIR);
const checkpointFilePath = path.join(questionBanksDir, CHECKPOINT_FILE_NAME);
const mcpServerEntrypoint = path.resolve(repositoryRoot, 'packages/mcp-server/dist/server.js');
// Percorso al file di configurazione YAML per la distribuzione dei topic AI
const topicConfigPath = path.resolve(repositoryRoot, 'data/ai-topic-config.yaml');

const parsePort = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export const env = {
  backendPort: parsePort(process.env.BACKEND_PORT, DEFAULT_API_PORT),
  awsRegion: process.env.AWS_REGION ?? 'eu-west-1',
  bedrockModelId: process.env.BEDROCK_MODEL_ID ?? 'eu.anthropic.claude-sonnet-4-5-20250929-v1:0',
  awsProfile: process.env.AWS_PROFILE,
  bedrockMockFallback: process.env.BEDROCK_MOCK_FALLBACK !== 'false',
  questionBanksDir,
  checkpointFilePath,
  repositoryRoot,
  topicConfigPath,
  mcpServerCommand: process.execPath,
  mcpServerArgs: [mcpServerEntrypoint],
} as const;
