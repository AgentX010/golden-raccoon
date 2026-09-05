import { describe, expect, it } from "vitest";
import { MemoryCacheStore } from "./memoryStore";
import { createCacheKey } from "./keys";
import { getOrLoad } from "./swr";

describe("server cache", () => {
  it("coalesces concurrent misses and keeps network-aware keys separate", async () => {
    const store = new MemoryCacheStore();
    let calls = 0;
    const key = createCacheKey({ chainFamily: "evm", network: "testnet", walletAddress: "0xA", resource: "portfolio" });
    const reads = await Promise.all(Array.from({ length: 50 }, () => getOrLoad({
      store,
      key,
      loader: async () => { calls += 1; await Promise.resolve(); return { calls }; },
      ttlMs: 1_000,
    })));
    expect(calls).toBe(1);
    expect(reads.every((read) => read.state === "fresh" && read.value?.calls === 1)).toBe(true);

    const otherNetwork = createCacheKey({ chainFamily: "evm", network: "mainnet", walletAddress: "0xA", resource: "portfolio" });
    expect(otherNetwork).not.toBe(key);
  });

  it("serves stale values while revalidating and supports tags", async () => {
    let now = 0;
    const store = new MemoryCacheStore({ now: () => now });
    store.set("k", "old", { ttlMs: 10, staleMs: 100, tags: ["wallet:a"] });
    now = 20;
    let refreshed = 0;
    const stale = await getOrLoad({ store, key: "k", loader: async () => { refreshed += 1; return "new"; }, ttlMs: 10, staleMs: 100, now });
    expect(stale).toMatchObject({ state: "stale", value: "old" });
    await Promise.resolve();
    expect(refreshed).toBe(1);
    expect(store.invalidateTags(["wallet:a"])).toBe(1);
  });

  it("negative caches failures without preventing a later success", async () => {
    let now = 0;
    const store = new MemoryCacheStore({ now: () => now });
    const options = { store, key: "failure", ttlMs: 100, negativeTtlMs: 5, loader: async () => { throw new Error("upstream"); } };
    expect((await getOrLoad(options)).state).toBe("negative");
    expect((await getOrLoad({ ...options, loader: async () => "ok" })).state).toBe("negative");
    now = 6;
    const success = await getOrLoad({ ...options, loader: async () => "ok" });
    expect(success).toMatchObject({ state: "fresh", value: "ok" });
  });

  it("falls through when a backend read fails", async () => {
    const broken = new MemoryCacheStore();
    broken.get = () => { throw new Error("backend down"); };
    const result = await getOrLoad({ store: broken, key: "broken", loader: async () => "live", ttlMs: 100 });
    expect(result).toMatchObject({ state: "fresh", value: "live" });
  });
});
