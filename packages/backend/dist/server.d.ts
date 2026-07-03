import { McpClient } from './mcp/McpClient.js';
export declare const createApp: () => {
    app: import("express-serve-static-core").Express;
    mcpClient: McpClient;
};
