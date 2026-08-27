/**
 * EVM quote adapter.
 *
 * Uses the DexScreener public API to resolve token pairs, prices, and
 * liquidity across configured EVM chains.  DexScreener does not return
 * swap calldata — the adapter provides a verified price quote that the
 * wallet uses to build the actual swap transaction client-side.
 *
 * This adapter is wrapped with `runProviderAdapter` for timeouts,
 * bounded retries, and structured error normalization.
 */
import "server-only";

import { ProviderRequestError, runProviderAdapter } from "@/server/providers/adapter";
import { getScanNetwork } from "@/lib/scanNetworks";
import { getChainFamily } from "@/lib/chainIdentity";
import {
  type QuoteProviderConfig,
  type QuoteRequest,
  type QuoteResult,
  defaultQuoteProviderConfig,
} from "@/server/providers/quote/types";

// ─── Types ───────────────────────────────────────────────────────────

type DexScreenerPair = {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: { address: string; name: string; symbol: string };
  quoteToken: { address: string; name: string; symbol: string };
  priceNative: string;
  priceUsd: string;
  txns: Record<string, { buys: number; sells: number }>;
  volume: Record<string, number>;
  priceChange: Record<string, number>;
  liquidity: { usd: number; base: number; quote: number };
  fdv: number;
  pairCreatedAt: number;
  info?: {
    imageUrl?: string;
    websites?: { label: string; url: string }[];
    socials?: { type: string; url: string }[];
  };
};

// ─── Simple in-memory cache (max 100 entries, 15 s TTL) ──────────────

const cacheStore = new Map<string, { pairs: DexScreenerPair[]; expiresAt: number }>();
const inFlight = new Map<string, Promise<DexScreenerPair[]>>();
const MAX_CACHE = 100;
const CACHE_TTL_MS = 15_000;

function cacheGet(key: string): DexScreenerPair[] | undefined {
  const entry = cacheStore.get(key);
  if (entry && entry.expiresAt > Date.now()) return entry.pairs;
  cacheStore.delete(key);
  return undefined;
}

function cacheSet(key: string, pairs: DexScreenerPair[]) {
  if (cacheStore.size >= MAX_CACHE) {
    // Evict oldest entry
    const firstKey = cacheStore.keys().next().value;
    if (firstKey !== undefined) cacheStore.delete(firstKey);
  }
  cacheStore.set(key, { pairs, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ─── DexScreener API ─────────────────────────────────────────────────

const DEXSCREENER_BASE = "https://api.dexscreener.com";

function retryAfterMs(response: Response) {
  const header = response.headers.get("retry-after");
  if (!header) return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
  const date = Date.parse(header);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : undefined;
}

async function fetchTokenPairs(chain: string, tokenAddress: string, signal?: AbortSignal): Promise<DexScreenerPair[]> {
  const cacheKey = `${chain}:${tokenAddress}`.toLowerCase();
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const existing = inFlight.get(cacheKey);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const url = `${DEXSCREENER_BASE}/tokens/v1/${tokenAddress}`;
      const response = await fetch(url, {
        signal,
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        if (response.status === 404) return [];
        throw new ProviderRequestError(
          `DexScreener returned HTTP ${response.status}.`,
          response.status === 429 ? "rate_limited" : "provider_error",
          { retryable: response.status === 429 || response.status >= 500, status: response.status, retryAfterMs: retryAfterMs(response) },
        );
      }

      const data = (await response.json()) as DexScreenerPair[] | { pairs?: DexScreenerPair[] };
      if (!Array.isArray(data) && !Array.isArray(data.pairs)) {
        throw new ProviderRequestError("DexScreener returned malformed pair data.", "malformed_response", { retryable: true });
      }
      const pairsArray = Array.isArray(data) ? data : (data as Record<string, unknown>).pairs as DexScreenerPair[] ?? [];
      const filtered = pairsArray.filter((p) => p.chainId === chain.toLowerCase());

      cacheSet(cacheKey, filtered);
      return filtered;
    } finally {
      inFlight.delete(cacheKey);
    }
  })();

  inFlight.set(cacheKey, promise);
  return promise;
}

// ─── Resolve chain ───────────────────────────────────────────────────

function resolveDexScreenerChainId(scanNetwork: { dexScreenerChainId?: string; id: string }): string | null {
  return scanNetwork.dexScreenerChainId ?? null;
}

// ─── Find best pair ──────────────────────────────────────────────────

function findBestPair(
  pairs: DexScreenerPair[],
  toSymbol: string,
  minLiquidityUsd: number = 100,
): DexScreenerPair | null {
  const candidates = pairs.filter(
    (p) =>
      p.quoteToken.symbol.toUpperCase() === toSymbol.toUpperCase() &&
      (p.liquidity?.usd ?? 0) >= minLiquidityUsd,
  );

  if (candidates.length === 0) return null;

  // Sort by liquidity descending and pick the deepest
  candidates.sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0));
  return candidates[0];
}

// ─── Thrown-errors operation ─────────────────────────────────────────

async function runEvmQuoteOperation(request: QuoteRequest, signal?: AbortSignal): Promise<QuoteResult> {
  const chainFamily = getChainFamily(request.chain);
  if (chainFamily === "stellar") {
    throw new ProviderRequestError(`EVM adapter does not support Stellar chain: ${request.chain}`, "invalid_request");
  }

  const scanNetwork = getScanNetwork(request.chain);
  const dsChainId = scanNetwork ? resolveDexScreenerChainId(scanNetwork) : null;
  if (!dsChainId) {
    throw new ProviderRequestError(`Chain ${request.chain} is not supported by DexScreener`, "invalid_request");
  }

  const fromAddress = request.fromAssetMeta?.contractAddress || request.fromAsset;
  const fromSymbol = request.fromAssetMeta?.symbol || request.fromAsset;
  const toSymbol = request.toAssetMeta?.symbol || request.toAsset;

  // Fetch token pairs from DexScreener
  const pairs = await fetchTokenPairs(dsChainId, fromAddress, signal);

  if (pairs.length === 0) {
    throw new ProviderRequestError(`No DexScreener pairs found for ${fromSymbol} on ${dsChainId}.`, "invalid_request");
  }

  // Find the best pair against the destination token
  const bestPair = findBestPair(pairs, toSymbol);

  if (!bestPair || !bestPair.liquidity) {
    throw new ProviderRequestError(`No active ${fromSymbol}/${toSymbol} trading pair found on ${dsChainId}.`, "invalid_request");
  }

  const priceUsd = Number.parseFloat(bestPair.priceUsd);
  if (!Number.isFinite(priceUsd) || priceUsd <= 0) {
    throw new ProviderRequestError(`Malformed price data from DexScreener for ${fromSymbol}.`, "malformed_response", { retryable: true });
  }

  const numericAmount = Number.parseFloat(request.amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new ProviderRequestError(`Invalid swap amount: ${request.amount}`, "invalid_request");
  }

  const liquidityUsd = bestPair.liquidity.usd;
  const estimatedValueUsd = numericAmount * priceUsd;
  const priceImpactBps = liquidityUsd > 0
    ? Math.min(10_000, Math.round((estimatedValueUsd / liquidityUsd) * 10_000))
    : 500;

  const outputPrice = bestPair.priceNative
    ? Number.parseFloat(bestPair.priceNative)
    : 1;

  const expectedOutput = numericAmount * (outputPrice > 0 ? 1 / outputPrice : 1);
  const minReceive = expectedOutput * (1 - request.slippageBps / 10_000);
  const now = new Date();
  const fetchedAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + 15_000).toISOString(); // 15 s fresh

  const route = [
    `${fromSymbol}:${bestPair.baseToken.address}`,
    `${toSymbol}:${bestPair.quoteToken.address}`,
  ];

  return {
    provider: "dexscreener",
    routeType: "evm_dex",
    route,
    inputAmount: request.amount,
    expectedOutputAmount: expectedOutput.toFixed(6),
    minReceiveAmount: minReceive.toFixed(6),
    estimatedValueUsd: Math.round(estimatedValueUsd * 100) / 100,
    priceImpactBps,
    slippageBps: request.slippageBps,
    feeEstimate: {
      nativeToken: "ETH",
      amount: "0",
      usdValue: 0,
    },
    status: "fresh",
    fetchedAt,
    expiresAt,
    detail: `DexScreener quote via ${bestPair.dexId} on ${dsChainId}: ${fromSymbol} → ${toSymbol} at $${priceUsd.toFixed(6)} (liq: $${liquidityUsd.toLocaleString()}).`,
    providerMeta: {
      provider: "dexscreener",
      network: dsChainId,
      latencyMs: 0,
      detail: `Pair: ${bestPair.pairAddress} | DEX: ${bestPair.dexId} | Liquidity: $${liquidityUsd.toLocaleString()}`,
    },
  };
}

// ─── Main adapter ────────────────────────────────────────────────────

export async function getEvmQuote(
  request: QuoteRequest,
  config: QuoteProviderConfig = defaultQuoteProviderConfig,
): Promise<QuoteResult> {
  const scanNetwork = getScanNetwork(request.chain);
  const chainId = scanNetwork?.goPlusChainId ? Number(scanNetwork.goPlusChainId) : undefined;
  const result = await runProviderAdapter(
    (signal) => runEvmQuoteOperation(request, signal),
    {
      kind: "execution",
      provider: "dexscreener",
      label: "DexScreener price feed",
      timeoutMs: config.timeoutMs,
      retries: config.retries,
      backoffMs: config.backoffMs,
      identity: { family: "evm", network: request.chain, chainId },
      expectedIdentity: { family: "evm", network: request.chain, chainId },
      validate: (value) => Boolean(value && typeof value === "object" && "expiresAt" in value && "providerMeta" in value),
    },
  );

  if (!result.ok || !result.value) {
    throw new Error(result.error?.message ?? "DexScreener returned no quote.");
  }

  return result.value as QuoteResult;
}
