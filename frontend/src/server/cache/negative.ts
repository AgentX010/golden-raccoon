export const DEFAULT_NEGATIVE_TTL_MS = 5_000;

export function negativeCacheOptions(ttlMs = DEFAULT_NEGATIVE_TTL_MS) {
  return { ttlMs: Math.max(1, ttlMs) };
}
