import type { DocumentationResult } from '@aws-exam-generator/shared';

interface CacheEntry {
  expiresAt: number;
  results: DocumentationResult[];
}

export class DocumentationCache {
  private readonly entries = new Map<string, CacheEntry>();

  constructor(private readonly ttlMs: number = 60_000) {}

  get(key: string): DocumentationResult[] | null {
    const entry = this.entries.get(key);
    if (!entry) {
      return null;
    }
    if (entry.expiresAt < Date.now()) {
      this.entries.delete(key);
      return null;
    }
    return entry.results;
  }

  set(key: string, results: DocumentationResult[]): void {
    this.entries.set(key, {
      expiresAt: Date.now() + this.ttlMs,
      results,
    });
  }
}
