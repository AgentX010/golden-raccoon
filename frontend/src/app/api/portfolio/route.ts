import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { portfolioCacheKey, serverCache, walletCacheTag, resourceCacheTag, getOrLoad } from "@/server/cache";
import { withCacheHeaders, withCacheStatus } from "@/server/cache/strategy";
import { getPortfolioSnapshot } from "@/server/portfolio/getPortfolio";
import { checkRateLimit } from "@/server/security/rateLimit";
import { anyWalletAddressSchema, chainIdSchema, validateWalletAddressForChain } from "@/server/security/inputValidation";

const querySchema = z.object({
  walletAddress: anyWalletAddressSchema,
  chain: chainIdSchema,
}).superRefine((value, context) => {
  if (!validateWalletAddressForChain(value.walletAddress, value.chain)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["walletAddress"], message: "Wallet address does not match the selected chain" });
  }
});

export async function GET(request: NextRequest) {
  const rateLimited = checkRateLimit(request, { namespace: "portfolio", limit: 60, windowMs: 60_000 });

  if (rateLimited) {
    return rateLimited;
  }

  const parsed = querySchema.safeParse({
    walletAddress: request.nextUrl.searchParams.get("walletAddress") ?? undefined,
    chain: request.nextUrl.searchParams.get("chain") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const chainFamily = parsed.data.chain?.startsWith("stellar") ? "stellar" : "evm";
  const cached = await getOrLoad({
    store: serverCache,
    key: portfolioCacheKey({ chainFamily, network: parsed.data.chain ?? "legacy-evm", walletAddress: parsed.data.walletAddress, params: { chain: parsed.data.chain } }),
    loader: async () => (await getPortfolioSnapshot(parsed.data.walletAddress, parsed.data.chain)).portfolio,
    ttlMs: 45_000,
    staleMs: 45_000,
    tags: [resourceCacheTag("portfolio"), parsed.data.walletAddress ? walletCacheTag(parsed.data.walletAddress) : "anonymous"],
  });

  if (cached.state === "negative") {
    return NextResponse.json({ error: "portfolio_unavailable" }, { status: 503 });
  }

  return withCacheStatus(withCacheHeaders(NextResponse.json(cached.value), "portfolio"), cached.state);
}
