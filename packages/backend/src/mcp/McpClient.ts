import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { MCP_RETRY_ATTEMPTS, MCP_RETRY_INTERVAL_MS, documentationResultSchema, type DocumentationResult } from '@aws-exam-generator/shared';

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export class McpClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private connected = false;

  constructor(
    private readonly command: string,
    private readonly args: string[],
  ) {}

  private async ensureConnected(): Promise<void> {
    if (this.connected) {
      return;
    }
    this.transport = new StdioClientTransport({
      command: this.command,
      args: this.args,
    });
    this.client = new Client(
      {
        name: 'aws-exam-generator-backend',
        version: '1.0.0',
      },
      {
        capabilities: {},
      },
    );
    await this.client.connect(this.transport);
    this.connected = true;
  }

  async searchByService(serviceName: string, topic?: string): Promise<DocumentationResult[]> {
    return this.callTool('search_by_service', { serviceName, topic });
  }

  async searchByDomain(domain: string, topic?: string): Promise<DocumentationResult[]> {
    return this.callTool('search_by_domain', { domain, topic });
  }

  async searchByTopic(query: string, domains?: string[], services?: string[]): Promise<DocumentationResult[]> {
    return this.callTool('search_by_topic', { query, domains, services });
  }

  async close(): Promise<void> {
    if (this.transport && 'close' in this.transport && typeof this.transport.close === 'function') {
      await this.transport.close();
    }
    this.connected = false;
  }

  private async callTool(name: string, args: Record<string, unknown>): Promise<DocumentationResult[]> {
    let attempt = 0;
    let lastError: unknown;

    while (attempt < MCP_RETRY_ATTEMPTS) {
      attempt += 1;
      try {
        await this.ensureConnected();
        const response = await this.client?.callTool({ name, arguments: args } as never);
        const content = (response as { content?: Array<{ type?: string; text?: string }> } | undefined)?.content ?? [];
        const textPayload = content.find((entry) => entry.type === 'text')?.text;
        if (!textPayload) {
          return [];
        }
        const parsed = JSON.parse(textPayload);
        return documentationResultSchema.array().parse(parsed);
      } catch (error) {
        lastError = error;
        this.connected = false;
        if (attempt < MCP_RETRY_ATTEMPTS) {
          await sleep(MCP_RETRY_INTERVAL_MS);
        }
      }
    }

    throw new Error(`MCP tool ${name} failed after ${MCP_RETRY_ATTEMPTS} attempts: ${String(lastError)}`);
  }
}
