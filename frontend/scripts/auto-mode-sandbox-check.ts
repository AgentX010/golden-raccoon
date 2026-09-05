import { getSuggestedAutoModePolicy } from "../src/server/autoMode/storage";
import { runAutoModeBacktest, verifyGuardrailProof, evaluateShadowAction, type ShadowCandidate } from "../src/server/autoMode/sandbox";

const policy = getSuggestedAutoModePolicy("fixture-wallet");
const candidate: ShadowCandidate = {
  id: "fixture-1", chainFamily: "evm", network: "testnet", chain: "Base", asset: "USDC",
  dailyValueAlreadyUsd: 0, tradeValueUsd: 10, portfolioValueUsd: 1_000, riskScore: 10,
  slippageBps: 10, priceImpactBps: 10, stableReservePercentAfter: 30, stopConditionTriggered: false,
  safetySignals: { assetKnown: true, criticalContractRisk: false, canSell: true, phishingDetected: false, identityConflict: false, hasSourceCoverage: true },
};
async function main() {
  const result = await evaluateShadowAction(policy, candidate);
  if (result.sideEffects !== "none" || !verifyGuardrailProof(result.proof, policy).valid) throw new Error("sandbox proof verification failed");
  const report = await runAutoModeBacktest(policy, [candidate]);
  if (report.total !== 1 || report.allowed !== 1) throw new Error("sandbox backtest failed");
  console.log("Auto Mode sandbox checks passed.");
}

void main();
