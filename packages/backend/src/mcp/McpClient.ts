import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { MCP_RETRY_ATTEMPTS, MCP_RETRY_INTERVAL_MS, documentationResultSchema, type DocumentationResult } from '@aws-exam-generator/shared';

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

// Shape of a single hit from the official aws-documentation-mcp-server search_documentation tool
interface AwsDocSearchResult {
  url: string;
  title: string;
  context?: string | null;
}

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
    // Child inherits our env so `uvx` resolves via PATH and server-specific vars (e.g. AWS_DOCUMENTATION_PARTITION) pass through
    const childEnv: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (typeof value === 'string') {
        childEnv[key] = value;
      }
    }
    this.transport = new StdioClientTransport({
      command: this.command,
      args: this.args,
      env: childEnv,
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
    const searchPhrase = topic ? `${serviceName} ${topic}` : serviceName;
    return this.searchDocumentation(searchPhrase, serviceName, undefined);
  }

  async searchByDomain(domain: string, topic?: string): Promise<DocumentationResult[]> {
    const searchPhrase = topic ? `${domain} ${topic}` : domain;
    return this.searchDocumentation(searchPhrase, undefined, domain);
  }

  async searchByTopic(query: string, domains?: string[], services?: string[]): Promise<DocumentationResult[]> {
    const searchPhrase = [query, ...(services ?? [])].join(' ');
    return this.searchDocumentation(searchPhrase, services?.[0], domains?.[0]);
  }

  async close(): Promise<void> {
    if (this.transport && 'close' in this.transport && typeof this.transport.close === 'function') {
      await this.transport.close();
    }
    this.connected = false;
  }

  private async searchDocumentation(searchPhrase: string, service: string | undefined, domain: string | undefined): Promise<DocumentationResult[]> {
    const payload = await this.callTool('search_documentation', { search_phrase: searchPhrase, limit: 5 });
    const results = (payload.search_results ?? []) as AwsDocSearchResult[];
    const mapped = results.map((entry) => ({
      title: entry.title,
      url: entry.url,
      snippet: entry.context && entry.context.trim().length > 0 ? entry.context : entry.title,
      service: service ?? 'AWS',
      domain: domain ?? 'general',
      source: 'aws-docs-live' as const,
    }));
    return documentationResultSchema.array().parse(mapped);
  }

  private async callTool(name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
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
          return {};
        }
        return JSON.parse(textPayload);
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

