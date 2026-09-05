import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { gateFeature } from "@/server/features/evaluator";
import {
  closeAutoModeAuthorization,
  getAutoModeSnapshot,
} from "@/server/autoMode/storage";
import { withCacheHeaders } from "@/server/cache/strategy";
import { checkRateLimitProfile } from "@/server/security/rateLimit";
import { resolveWalletSession } from "@/server/security/walletSession";
import { evaluateCapability } from "@/server/security/authz";

export const AUTHZ_CAPABILITY = "auto-mode:authorize" as const;

const authorizationSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("authorize"),
    walletAddress: z.string().trim().min(1).max(120),
    confirmationPhrase: z.literal("AUTHORIZE AUTO MODE"),
    allowanceUsd: z.number().positive(),
    expiresAt: z.string().datetime(),
  }),
  z.object({
    action: z.literal("cancel"),
    walletAddress: z.string().trim().min(1).max(120),
  }),
  z.object({
    action: z.literal("reject"),
    walletAddress: z.string().trim().min(1).max(120),
  }),
]);

export async function POST(request: NextRequest) {
  const rateLimited = checkRateLimitProfile(request, "alertRuleWrite");
  if (rateLimited) return rateLimited;

  const body = await request.json().catch(() => ({}));
  const parsed = authorizationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_auto_mode_authorization", detail: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const autoModeGate = gateFeature("auto_mode_authorization", parsed.data.walletAddress ?? "");
  if (!autoModeGate.enabled) {
    return NextResponse.json(
      { error: "feature_disabled", feature: "auto_mode_authorization", detail: autoModeGate.detail },
      { status: 403 },
    );
  }

  const session = resolveWalletSession(request, {
    suppliedWallet: parsed.data.walletAddress,
  });
  if (session.response) return session.response;
  const wallet = session.wallet!;
  const authz = evaluateCapability(
    { kind: "wallet", walletAddress: wallet, walletHash: "route" },
    AUTHZ_CAPABILITY,
    { walletAddress: wallet },
  );
  if (!authz.allowed) return NextResponse.json({ error: "auth_error", reason: authz.reason }, { status: 403 });

  try {
    if (parsed.data.action === "authorize") {
      const prerequisites = getAutoModeSnapshot(wallet).activationPrerequisites;
      if (!prerequisites.ready) {
        return NextResponse.json(
          {
            error: "auto_mode_prerequisites_incomplete",
            detail:
              "Authorization is unavailable until durable storage, shared execution enforcement, independent contract verification, and an exact policy-bound wallet signature are integrated.",
            blockers: prerequisites.blockers,
          },
          { status: 409 },
        );
      }
      // The production path deliberately stops above. Dependency #33 must
      // verify a fresh signature over the exact policy payload before the
      // future-ready storage helper can be called.
    } else {
      closeAutoModeAuthorization(wallet, parsed.data.action === "cancel" ? "cancelled" : "rejected");
    }

    return withCacheHeaders(
      NextResponse.json(getAutoModeSnapshot(wallet)),
      "rules",
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "auto_mode_authorization_failed";
    const status =
      message === "contract_unverified"
        ? 409
        : message === "authorization_confirmation_required"
          ? 403
          : 400;
    return NextResponse.json(
      {
        error: message,
        detail:
          message === "contract_unverified"
            ? "Auto mode cannot be authorized until the configured contract, network, and policy version are independently verified."
            : undefined,
      },
      { status },
    );
  }
}
