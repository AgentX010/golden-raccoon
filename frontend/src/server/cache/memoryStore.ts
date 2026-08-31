import type { CacheRead, CacheRecord, CacheStore } from "./store";
import { cacheMetrics } from "./metrics";

export type MemoryCacheOptions = { maxEntries?: number; now?: () => number };

export class MemoryCacheStore implements CacheStore {
  private readonly entries = new Map<string, CacheRecord>();
  private readonly maxEntries: number;
  private readonly now: () => number;

  constructor(options: MemoryCacheOptions = {}) {
    this.maxEntries = Math.max(1, Math.floor(options.maxEntries ?? 1_000));
    this.now = options.now ?? Date.now;
  }

  get<T>(key: string, now = this.now()): CacheRead<T> {
    const entry = this.entries.get(key) as CacheRecord<T> | undefined;
    if (!entry) return { state: "miss" };
    if (now < entry.expiresAt) {
      this.entries.delete(key);
      this.entries.set(key, entry);
      if (entry.negative) return { state: "negative", error: entry.error, record: entry };
      return { state: "fresh", value: entry.value, record: entry };
    }
    if (now < entry.staleUntil && !entry.negative) {
      return { state: "stale", value: entry.value, record: entry };
    }
    this.entries.delete(key);
    return { state: "miss" };
  }

  set<T>(key: string, value: T, options: { ttlMs: number; staleMs?: number; tags?: string[] }): void {
    this.write(key, { value, createdAt: this.now(), expiresAt: this.now() + Math.max(0, options.ttlMs), staleUntil: this.now() + Math.max(0, options.ttlMs) + Math.max(0, options.staleMs ?? 0), tags: [...(options.tags ?? [])], negative: false });
  }

  setNegative(key: string, error: unknown, options: { ttlMs?: number; tags?: string[] } = {}): void {
    const message = error instanceof Error ? error.message : String(error);
    const ttlMs = Math.max(1, options.ttlMs ?? 5_000);
    this.write(key, { error: message, createdAt: this.now(), expiresAt: this.now() + ttlMs, staleUntil: this.now() + ttlMs, tags: [...(options.tags ?? [])], negative: true });
  }

  delete(key: string) {
    this.entries.delete(key);
  }

  invalidateTags(tags: readonly string[]): number {
    const wanted = new Set(tags);
    let removed = 0;
    for (const [key, entry] of this.entries) {
      if (entry.tags.some((tag) => wanted.has(tag))) {
        this.entries.delete(key);
        removed += 1;
      }
    }
    return removed;
  }

  clear() {
    this.entries.clear();
  }

  size() {
    return this.entries.size;
  }

  private write(key: string, entry: CacheRecord) {
    if (this.entries.has(key)) this.entries.delete(key);
    this.entries.set(key, entry);
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value as string | undefined;
      if (!oldest) break;
      this.entries.delete(oldest);
      cacheMetrics.increment("eviction");
    }
  }
}

export const serverCache = new MemoryCacheStore();
