import type { DocumentationResult } from '@aws-exam-generator/shared';
export declare class DocumentationCache {
    private readonly ttlMs;
    private readonly entries;
    constructor(ttlMs?: number);
    get(key: string): DocumentationResult[] | null;
    set(key: string, results: DocumentationResult[]): void;
}
