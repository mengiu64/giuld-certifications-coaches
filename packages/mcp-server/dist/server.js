import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { DocumentationCache } from './cache/documentation-cache.js';
import { searchByDomain } from './tools/search-by-domain.js';
import { searchByService } from './tools/search-by-service.js';
import { searchByTopic } from './tools/search-by-topic.js';
const cache = new DocumentationCache();
const server = new Server({
    name: 'aws-docs-mcp-server',
    version: '1.0.0',
}, {
    capabilities: {
        tools: {},
    },
});
const tools = [
    {
        name: 'search_by_service',
        description: 'Search realistic AWS documentation snippets by service name and optional topic.',
        inputSchema: {
            type: 'object',
            properties: {
                serviceName: { type: 'string', description: 'AWS service name such as EC2, S3, IAM, or Lambda' },
                topic: { type: 'string', description: 'Optional topic filter such as scaling, encryption, or resilience' },
            },
            required: ['serviceName'],
        },
    },
    {
        name: 'search_by_domain',
        description: 'Search realistic AWS documentation snippets by certification domain and optional topic.',
        inputSchema: {
            type: 'object',
            properties: {
                domain: { type: 'string', description: 'Certification domain identifier' },
                topic: { type: 'string', description: 'Optional topic filter' },
            },
            required: ['domain'],
        },
    },
    {
        name: 'search_by_topic',
        description: 'Search realistic AWS documentation snippets by topic with optional domain or service constraints.',
        inputSchema: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'Topic search query' },
                domains: { type: 'array', items: { type: 'string' } },
                services: { type: 'array', items: { type: 'string' } },
            },
            required: ['query'],
        },
    },
];
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [...tools] }));
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const toolName = request.params.name;
    const args = (request.params.arguments ?? {});
    const cacheKey = `${toolName}:${JSON.stringify(args)}`;
    const cached = cache.get(cacheKey);
    if (cached) {
        return {
            content: [{ type: 'text', text: JSON.stringify(cached) }],
        };
    }
    let result;
    switch (toolName) {
        case 'search_by_service':
            result = searchByService(String(args.serviceName ?? ''), typeof args.topic === 'string' ? args.topic : undefined);
            break;
        case 'search_by_domain':
            result = searchByDomain(String(args.domain ?? ''), typeof args.topic === 'string' ? args.topic : undefined);
            break;
        case 'search_by_topic':
            result = searchByTopic(String(args.query ?? ''), Array.isArray(args.domains) ? args.domains.map(String) : undefined, Array.isArray(args.services) ? args.services.map(String) : undefined);
            break;
        default:
            throw new Error(`Unknown tool: ${toolName}`);
    }
    cache.set(cacheKey, result);
    return {
        content: [{ type: 'text', text: JSON.stringify(result) }],
    };
});
const transport = new StdioServerTransport();
await server.connect(transport);
//# sourceMappingURL=server.js.map