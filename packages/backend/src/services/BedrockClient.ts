import { BedrockRuntimeClient, ConverseCommand, ConverseStreamCommand } from '@aws-sdk/client-bedrock-runtime';
import { fromNodeProviderChain, fromSSO } from '@aws-sdk/credential-providers';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import { BEDROCK_RETRY_DELAYS_MS } from '@aws-exam-generator/shared';
import type { ConverseCommandInput } from '@aws-sdk/client-bedrock-runtime';

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

// A hard upper bound on any single Bedrock call (including credential resolution), so that an
// unreachable endpoint, a stuck SSO/credential provider, or a silently dropped connection cannot
// hang question generation forever - it always surfaces as an error the caller can retry or fall
// back on.
const BEDROCK_CALL_TIMEOUT_MS = 20_000;

const withTimeout = <T>(operation: () => Promise<T>, timeoutMs: number, label: string): Promise<T> =>
  Promise.race([
    operation(),
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
    }),
  ]);

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
      requestHandler: new NodeHttpHandler({
        connectionTimeout: 5_000,
        socketTimeout: BEDROCK_CALL_TIMEOUT_MS,
      }),
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
        return await withTimeout(operation, BEDROCK_CALL_TIMEOUT_MS, 'Bedrock request');
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
