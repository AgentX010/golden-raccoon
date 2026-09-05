export type CacheState = "fresh" | "stale" | "negative" | "miss";

export type CacheRecord<T = unknown> = {
  value?: T;
  error?: string;
  createdAt: number;
  expiresAt: number;
  staleUntil: number;
  tags: string[];
  negative: boolean;
};

export type CacheRead<T = unknown> = {
  state: CacheState;
  value?: T;
  error?: string;
  record?: CacheRecord<T>;
};

export type CacheStore = {
  get<T>(key: string, now?: number): CacheRead<T>;
  set<T>(key: string, value: T, options: { ttlMs: number; staleMs?: number; tags?: string[] }): void;
  setNegative(key: string, error: unknown, options?: { ttlMs?: number; tags?: string[] }): void;
  delete(key: string): void;
  invalidateTags(tags: readonly string[]): number;
  clear(): void;
  size(): number;
};
