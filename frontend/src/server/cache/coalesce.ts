import { cacheMetrics } from "./metrics";

export class SingleFlight {
  private readonly pending = new Map<string, Promise<unknown>>();

  run<T>(key: string, loader: () => Promise<T>): Promise<T> {
    const existing = this.pending.get(key) as Promise<T> | undefined;
    if (existing) {
      cacheMetrics.increment("coalesced");
      return existing;
    }
    const promise = loader().finally(() => this.pending.delete(key));
    this.pending.set(key, promise);
    return promise;
  }

  has(key: string) {
    return this.pending.has(key);
  }
}

export const cacheSingleFlight = new SingleFlight();
