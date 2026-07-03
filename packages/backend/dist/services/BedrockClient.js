import { BedrockRuntimeClient, ConverseCommand, ConverseStreamCommand } from '@aws-sdk/client-bedrock-runtime';
import { fromNodeProviderChain, fromSSO } from '@aws-sdk/credential-providers';
import { BEDROCK_RETRY_DELAYS_MS } from '@aws-exam-generator/shared';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const buildCredentials = (profile) => (profile ? fromSSO({ profile }) : fromNodeProviderChain());
const isThrottlingError = (error) => {
    if (!(error instanceof Error)) {
        return false;
    }
    return error.name === 'ThrottlingException' || error.message.includes('ThrottlingException');
};
export class BedrockClient {
    modelId;
    client;
    constructor(region, profile, modelId) {
        this.modelId = modelId;
        this.client = new BedrockRuntimeClient({
            region,
            credentials: buildCredentials(profile),
        });
    }
    async generateText(systemPrompt, userPrompt) {
        const input = {
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
    async streamText(systemPrompt, userPrompt, onChunk) {
        const input = {
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
    async executeWithRetry(operation) {
        let lastError;
        for (let attempt = 0; attempt <= BEDROCK_RETRY_DELAYS_MS.length; attempt += 1) {
            try {
                return await operation();
            }
            catch (error) {
                lastError = error;
                if (!isThrottlingError(error) || attempt === BEDROCK_RETRY_DELAYS_MS.length) {
                    break;
                }
                await sleep(BEDROCK_RETRY_DELAYS_MS[attempt]);
            }
        }
        throw lastError instanceof Error ? lastError : new Error(String(lastError));
    }
}
//# sourceMappingURL=BedrockClient.js.map