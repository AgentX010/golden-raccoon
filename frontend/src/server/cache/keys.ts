import { canonicalJson } from "@/server/evaluation/harness/determinism";

export type CacheKeyInput = {
  chainFamily: "evm" | "stellar";
  network: string;
  walletAddress?: string;
  resource: string;
  params?: Record<string, unknown>;
};

export function createCacheKey(input: CacheKeyInput): string {
  return `gr:${input.chainFamily}:${input.network.trim().toLowerCase()}:${input.walletAddress?.trim().toLowerCase() || "anonymous"}:${input.resource}:${canonicalJson(input.params ?? {})}`;
}

export function portfolioCacheKey(input: Omit<CacheKeyInput, "resource">) {
  return createCacheKey({ ...input, resource: "portfolio" });
}

export function walletCacheTag(walletAddress: string) {
  return `wallet:${walletAddress.trim().toLowerCase()}`;
}

export function resourceCacheTag(resource: string) {
  return `resource:${resource}`;
}
