import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { applyStressScenario } from "@/server/portfolio/stress";
import { STRESS_SCENARIOS } from "@/server/portfolio/scenarios";
import { checkRateLimit } from "@/server/security/rateLimit";
import type { PortfolioSnapshot } from "@/server/types";

const bodySchema = z.object({
  snapshot: z.any(),
  scenarioId: z.string(),
});

export async function POST(request: NextRequest) {
  const rateLimited = checkRateLimit(request, { namespace: "portfolio-stress", limit: 30, windowMs: 60_000 });
  if (rateLimited) {
    return rateLimited;
  }

  let json: any;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { snapshot, scenarioId } = parsed.data;

  const scenario = STRESS_SCENARIOS.find((s) => s.id === scenarioId);
  if (!scenario) {
    return NextResponse.json({ error: "Scenario not found" }, { status: 400 });
  }

  // Cast snapshot to PortfolioSnapshot. In a real app we'd validate the structure more strictly.
  const portfolioSnapshot = snapshot as PortfolioSnapshot;
  
  if (!portfolioSnapshot || !portfolioSnapshot.holdings) {
    return NextResponse.json({ error: "Invalid snapshot" }, { status: 400 });
  }

  const result = applyStressScenario(portfolioSnapshot, scenario);

  return NextResponse.json(result);
}
