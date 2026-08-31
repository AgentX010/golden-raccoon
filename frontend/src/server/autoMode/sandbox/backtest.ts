import type { AutoModePolicy } from "@/server/autoMode/policy";
import { evaluateShadowAction, type ShadowCandidate } from "./shadowRunner";

export type BacktestReport = { total: number; allowed: number; rejected: number; reserveBlocked: number; bindingConstraintCounts: Record<string, number>; policyVersion: number };

export async function runAutoModeBacktest(policy: AutoModePolicy, candidates: readonly ShadowCandidate[]): Promise<BacktestReport> {
  const ordered = [...candidates].sort((a, b) => (a.id ?? "").localeCompare(b.id ?? ""));
  const report: BacktestReport = { total: ordered.length, allowed: 0, rejected: 0, reserveBlocked: 0, bindingConstraintCounts: {}, policyVersion: policy.policyVersion };
  for (const candidate of ordered) {
    const result = await evaluateShadowAction(policy, candidate);
    if (result.allowed) report.allowed += 1;
    else report.rejected += 1;
    if (result.blockers.includes("stable_reserve_below_minimum")) report.reserveBlocked += 1;
    if (result.bindingConstraint) report.bindingConstraintCounts[result.bindingConstraint] = (report.bindingConstraintCounts[result.bindingConstraint] ?? 0) + 1;
  }
  return report;
}
