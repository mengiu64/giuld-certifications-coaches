import { type CertificationConfig, type Question, type QuestionFormat } from '@aws-exam-generator/shared';
import { BedrockClient } from '../services/BedrockClient.js';
import { McpClient } from '../mcp/McpClient.js';
export declare class QuestionGenerator {
    private readonly bedrockClient;
    private readonly mcpClient;
    private readonly allowMockFallback;
    private lastBedrockRequestAt;
    constructor(bedrockClient: BedrockClient, mcpClient: McpClient, allowMockFallback: boolean);
    generateQuestion(certification: CertificationConfig, domainId: string, format: QuestionFormat): Promise<Question>;
    private fetchDocumentation;
    private buildSystemPrompt;
    private buildUserPrompt;
    private buildMockQuestion;
    private enforceBedrockDelay;
}
