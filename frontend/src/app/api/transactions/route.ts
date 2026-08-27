import { NextRequest, NextResponse } from "next/server";
import { withCacheHeaders } from "@/server/cache/strategy";
import { checkRateLimit } from "@/server/security/rateLimit";
import { listTransactionObservations, listTransactionRecords } from "@/server/storage";

export function GET(request: NextRequest) {
  const rateLimited = checkRateLimit(request, { namespace: "transactions", limit: 80, windowMs: 60_000 });

  if (rateLimited) {
    return rateLimited;
  }

  const walletAddress = request.nextUrl.searchParams.get("walletAddress") ?? undefined;
  const records = listTransactionRecords(walletAddress);

  return withCacheHeaders(NextResponse.json(records.map((record) => ({
    ...record,
    observations: listTransactionObservations(record.hash),
    finality: {
      confirmations: record.confirmationCount ?? 0,
      required: record.requiredConfirmations ?? 1,
      reached: record.finalityReached ?? false,
    },
  }))), "transactions");
}
