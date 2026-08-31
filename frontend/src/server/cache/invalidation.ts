import { serverCache } from "./memoryStore";
import { walletCacheTag } from "./keys";

export function invalidateCacheTags(tags: readonly string[]) {
  return serverCache.invalidateTags(tags);
}

export function invalidateWalletCache(walletAddress: string) {
  return invalidateCacheTags([walletCacheTag(walletAddress)]);
}

export function invalidatePortfolioForWallet(walletAddress: string) {
  return invalidateCacheTags([walletCacheTag(walletAddress), "resource:portfolio"]);
}
