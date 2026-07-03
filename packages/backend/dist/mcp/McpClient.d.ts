import { type DocumentationResult } from '@aws-exam-generator/shared';
export declare class McpClient {
    private readonly command;
    private readonly args;
    private client;
    private transport;
    private connected;
    constructor(command: string, args: string[]);
    private ensureConnected;
    searchByService(serviceName: string, topic?: string): Promise<DocumentationResult[]>;
    searchByDomain(domain: string, topic?: string): Promise<DocumentationResult[]>;
    searchByTopic(query: string, domains?: string[], services?: string[]): Promise<DocumentationResult[]>;
    close(): Promise<void>;
    private callTool;
}
