import { BedrockRuntimeClient, ConverseCommand, ConverseStreamCommand } from '@aws-sdk/client-bedrock-runtime';
import { fromNodeProviderChain, fromSSO } from '@aws-sdk/credential-providers';
import { BEDROCK_RETRY_DELAYS_MS } from '@aws-exam-generator/shared';
import type { ConverseCommandInput } from '@aws-sdk/client-bedrock-runtime';

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const buildCredentials = (profile?: string) => (profile ? fromSSO({ profile }) : fromNodeProviderChain());

const isThrottlingError = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }
  return error.name === 'ThrottlingException' || error.message.includes('ThrottlingException');
};

export class BedrockClient {
  private readonly client: BedrockRuntimeClient;

  constructor(region: string, profile: string | undefined, private readonly modelId: string) {
    this.client = new BedrockRuntimeClient({
      region,
      credentials: buildCredentials(profile),
    });
  }

  async generateText(systemPrompt: string, userPrompt: string): Promise<string> {
    const input: ConverseCommandInput = {
      modelId: this.modelId,
      system: [{ text: systemPrompt }],
      messages: [{ role: 'user', content: [{ text: userPrompt }] }],
      inferenceConfig: {
        temperature: 0.4,
        maxTokens: 1400,
      },
    };
    return this.executeWithRetry(async () => {
      const response = await this.client.send(new ConverseCommand(input));
      const parts = response.output?.message?.content ?? [];
      return parts
        .map((part) => ('text' in part && typeof part.text === 'string' ? part.text : ''))
        .join('')
        .trim();
    });
  }

  async streamText(systemPrompt: string, userPrompt: string, onChunk: (chunk: string) => void): Promise<string> {
    const input: ConverseCommandInput = {
      modelId: this.modelId,
      system: [{ text: systemPrompt }],
      messages: [{ role: 'user', content: [{ text: userPrompt }] }],
      inferenceConfig: {
        temperature: 0.4,
        maxTokens: 1400,
      },
    };

    return this.executeWithRetry(async () => {
      const response = await this.client.send(new ConverseStreamCommand(input));
      let combined = '';
      for await (const event of response.stream ?? []) {
        const text = event.contentBlockDelta?.delta?.text;
        if (text) {
          combined += text;
          onChunk(text);
        }
      }
      return combined.trim();
    });
  }

  private async executeWithRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= BEDROCK_RETRY_DELAYS_MS.length; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        if (!isThrottlingError(error) || attempt === BEDROCK_RETRY_DELAYS_MS.length) {
          break;
        }
        await sleep(BEDROCK_RETRY_DELAYS_MS[attempt]!);
      }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }
}
