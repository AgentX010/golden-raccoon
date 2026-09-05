import { NextResponse } from "next/server";
import { getAutoModeRecord } from "@/server/autoMode/storage";
import { evaluateShadowAction, runAutoModeBacktest, type ShadowCandidate } from "@/server/autoMode/sandbox";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { walletAddress?: string; candidate?: ShadowCandidate; candidates?: ShadowCandidate[] };
  const walletAddress = body.walletAddress?.trim();
  if (!walletAddress) return NextResponse.json({ error: "wallet_address_required" }, { status: 400 });
  const policy = getAutoModeRecord(walletAddress).policy;
  if (!policy) return NextResponse.json({ error: "auto_mode_policy_missing" }, { status: 409 });
  if (Array.isArray(body.candidates)) return NextResponse.json(await runAutoModeBacktest(policy, body.candidates));
  if (!body.candidate) return NextResponse.json({ error: "candidate_required" }, { status: 400 });
  return NextResponse.json(await evaluateShadowAction(policy, body.candidate));
}
