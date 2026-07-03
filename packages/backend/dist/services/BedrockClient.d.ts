export declare class BedrockClient {
    private readonly modelId;
    private readonly client;
    constructor(region: string, profile: string | undefined, modelId: string);
    generateText(systemPrompt: string, userPrompt: string): Promise<string>;
    streamText(systemPrompt: string, userPrompt: string, onChunk: (chunk: string) => void): Promise<string>;
    private executeWithRetry;
}
