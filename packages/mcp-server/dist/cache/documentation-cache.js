export class DocumentationCache {
    ttlMs;
    entries = new Map();
    constructor(ttlMs = 60_000) {
        this.ttlMs = ttlMs;
    }
    get(key) {
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
    set(key, results) {
        this.entries.set(key, {
            expiresAt: Date.now() + this.ttlMs,
            results,
        });
    }
}
//# sourceMappingURL=documentation-cache.js.map