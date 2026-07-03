export declare const env: {
    readonly backendPort: number;
    readonly awsRegion: string;
    readonly bedrockModelId: string;
    readonly awsProfile: string | undefined;
    readonly bedrockMockFallback: boolean;
    readonly questionBanksDir: string;
    readonly checkpointFilePath: string;
    readonly repositoryRoot: string;
    readonly mcpServerCommand: string;
    readonly mcpServerArgs: readonly [string];
};
