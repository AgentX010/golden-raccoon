import { cacheMetrics } from "./metrics";
import { cacheSingleFlight, type SingleFlight } from "./coalesce";
import { negativeCacheOptions } from "./negative";
import type { CacheStore } from "./store";

export type CachedRead<T> = { value: T; state: "fresh" | "stale"; error?: undefined } | { value?: undefined; state: "negative"; error: Error };

type CacheLoadInput<T> = {
  store: CacheStore;
  key: string;
  loader: () => Promise<T>;
  ttlMs: number;
  staleMs?: number;
  tags?: string[];
  negativeTtlMs?: number;
  flight?: SingleFlight;
  now?: number;
};

export async function getOrLoad<T>(input: CacheLoadInput<T>): Promise<CachedRead<T>> {
  const flight = input.flight ?? cacheSingleFlight;
  let cached;
  try {
    cached = input.store.get<T>(input.key, input.now);
  } catch {
    cacheMetrics.increment("backendError");
    return loadThrough(input, flight);
  }

  if (cached.state === "fresh") {
    cacheMetrics.increment("hit");
    return { state: "fresh", value: cached.value as T };
  }
  if (cached.state === "negative") {
    cacheMetrics.increment("negativeHit");
    return { state: "negative", error: new Error(cached.error ?? "cached_upstream_failure") };
  }
  if (cached.state === "stale") {
    cacheMetrics.increment("stale");
    void loadThrough(input, flight);
    return { state: "stale", value: cached.value as T };
  }

  cacheMetrics.increment("miss");
  return loadThrough(input, flight);
}

async function loadThrough<T>(input: CacheLoadInput<T>, flight: SingleFlight): Promise<CachedRead<T>> {
  try {
    const value = await flight.run(input.key, input.loader);
    try {
      input.store.set(input.key, value, { ttlMs: input.ttlMs, staleMs: input.staleMs, tags: input.tags });
    } catch {
      cacheMetrics.increment("backendError");
    }
    return { state: "fresh", value };
  } catch (error) {
    try {
      input.store.setNegative(input.key, error, { ...negativeCacheOptions(input.negativeTtlMs), tags: input.tags });
    } catch {
      cacheMetrics.increment("backendError");
    }
    return { state: "negative", error: error instanceof Error ? error : new Error(String(error)) };
  }
}
