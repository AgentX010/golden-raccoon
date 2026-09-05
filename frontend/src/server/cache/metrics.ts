export type CacheMetricName = "hit" | "miss" | "coalesced" | "stale" | "eviction" | "negativeHit" | "backendError";
export type CacheMetricsSnapshot = Record<CacheMetricName, number>;

const zero = (): CacheMetricsSnapshot => ({ hit: 0, miss: 0, coalesced: 0, stale: 0, eviction: 0, negativeHit: 0, backendError: 0 });

export class CacheMetrics {
  private counts = zero();

  increment(name: CacheMetricName) {
    this.counts[name] += 1;
  }

  snapshot(): CacheMetricsSnapshot {
    return { ...this.counts };
  }

  reset() {
    this.counts = zero();
  }
}

export const cacheMetrics = new CacheMetrics();
export const getCacheMetrics = () => cacheMetrics.snapshot();
