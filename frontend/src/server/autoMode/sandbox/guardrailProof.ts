import { canonicalJson, deterministicHash } from "@/server/evaluation/harness/determinism";
import { hashAutoModePolicy, type AutoModeBuyContext, type AutoModeBuyDecision, type AutoModePolicy } from "@/server/autoMode/policy";

export const GUARDRAIL_PROOF_SCHEMA_VERSION = 1 as const;

export type GuardrailConstraint = {
  name: string;
  limit: string | number | boolean;
  observed: string | number | boolean;
  passed: boolean;
};

export type GuardrailProof = {
  schemaVersion: typeof GUARDRAIL_PROOF_SCHEMA_VERSION;
  policyVersion: number;
  policyHash: string;
  chainFamily: "evm" | "stellar";
  network: string;
  inputSnapshotHash: string;
  constraints: GuardrailConstraint[];
  bindingConstraint?: string;
  allowed: boolean;
  proofHash: string;
};

function numericConstraints(policy: AutoModePolicy, context: AutoModeBuyContext): GuardrailConstraint[] {
  const tradePercent = context.portfolioValueUsd > 0 ? (context.tradeValueUsd / context.portfolioValueUsd) * 100 : Number.POSITIVE_INFINITY;
  return [
    { name: "max_daily_value_usd", limit: policy.maxDailyValueUsd, observed: context.dailyValueAlreadyUsd + context.tradeValueUsd, passed: context.dailyValueAlreadyUsd + context.tradeValueUsd <= policy.maxDailyValueUsd },
    { name: "max_risk_score", limit: policy.maxRiskScore, observed: context.riskScore, passed: context.riskScore <= policy.maxRiskScore },
    { name: "max_trade_percent", limit: policy.maxTradePercent, observed: tradePercent, passed: tradePercent <= policy.maxTradePercent },
    { name: "max_slippage_bps", limit: policy.maxSlippageBps, observed: context.slippageBps, passed: context.slippageBps <= policy.maxSlippageBps },
    { name: "max_price_impact_bps", limit: policy.maxPriceImpactBps, observed: context.priceImpactBps, passed: context.priceImpactBps <= policy.maxPriceImpactBps },
    { name: "min_stable_reserve_percent", limit: policy.minStableReservePercent, observed: context.stableReservePercentAfter, passed: context.stableReservePercentAfter >= policy.minStableReservePercent },
    { name: "chain_allowed", limit: policy.allowedChains.join(","), observed: context.chain, passed: policy.allowedChains.some((chain) => chain.trim().toLowerCase() === context.chain.trim().toLowerCase()) },
    { name: "asset_allowed", limit: policy.allowedAssets.join(","), observed: context.asset, passed: policy.allowedAssets.some((asset) => asset.trim().toLowerCase() === context.asset.trim().toLowerCase()) },
    { name: "stop_condition", limit: false, observed: context.stopConditionTriggered, passed: !context.stopConditionTriggered },
  ];
}

export function createGuardrailProof(input: {
  policy: AutoModePolicy;
  context: AutoModeBuyContext;
  decision: AutoModeBuyDecision;
  chainFamily: "evm" | "stellar";
  network: string;
}) {
  const constraints = numericConstraints(input.policy, input.context);
  const immutable = input.decision.immutableBuyBlockers.map((name) => ({ name: `immutable_buy_blocker:${name}`, limit: false, observed: true, passed: false }));
  const allConstraints = [...immutable, ...constraints];
  const bindingConstraint = input.decision.blockers[0]?.replace(/^immutable_buy_blocker:/, "immutable_buy_blocker:");
  const unsigned = {
    schemaVersion: GUARDRAIL_PROOF_SCHEMA_VERSION,
    policyVersion: input.policy.policyVersion,
    policyHash: hashAutoModePolicy(input.policy),
    chainFamily: input.chainFamily,
    network: input.network.trim().toLowerCase(),
    inputSnapshotHash: deterministicHash({ chainFamily: input.chainFamily, network: input.network.trim().toLowerCase(), context: input.context }),
    constraints: allConstraints,
    ...(bindingConstraint ? { bindingConstraint } : {}),
    allowed: input.decision.allowed,
  } satisfies Omit<GuardrailProof, "proofHash">;
  return { ...unsigned, proofHash: deterministicHash(unsigned) } satisfies GuardrailProof;
}

export function serializeGuardrailProof(proof: GuardrailProof) {
  return canonicalJson(proof);
}
