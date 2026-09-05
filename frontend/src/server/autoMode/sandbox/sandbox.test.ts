import { describe, expect, it } from "vitest";
import { getSuggestedAutoModePolicy } from "@/server/autoMode/storage";
import { engageKillSwitch, killSwitchStore, reenableKillSwitch } from "./killSwitch";
import { verifyGuardrailProof } from "./proofVerify";
import { evaluateShadowAction } from "./shadowRunner";

const candidate = { id: "a", chainFamily: "evm" as const, network: "testnet", chain: "Base", asset: "USDC", dailyValueAlreadyUsd: 0, tradeValueUsd: 10, portfolioValueUsd: 1_000, riskScore: 10, slippageBps: 10, priceImpactBps: 10, stableReservePercentAfter: 30, stopConditionTriggered: false, safetySignals: { assetKnown: true, criticalContractRisk: false, canSell: true, phishingDetected: false, identityConflict: false, hasSourceCoverage: true } };

describe("auto mode shadow sandbox", () => {
  it("emits an offline-verifiable proof and no side effects", async () => {
    const policy = getSuggestedAutoModePolicy("0xabc");
    const result = await evaluateShadowAction(policy, candidate);
    expect(result.sideEffects).toBe("none");
    expect(verifyGuardrailProof(result.proof, policy)).toEqual({ valid: true });
  });

  it("fails closed when the kill switch is engaged or unreadable", async () => {
    const policy = getSuggestedAutoModePolicy("0xabc");
    await engageKillSwitch(candidate, "operator", "maintenance");
    expect((await evaluateShadowAction(policy, candidate)).allowed).toBe(false);
    await reenableKillSwitch(candidate, "operator");
    killSwitchStore.failReads = true;
    expect((await evaluateShadowAction(policy, candidate)).allowed).toBe(false);
    killSwitchStore.failReads = false;
    await reenableKillSwitch(candidate, "test");
  });
});
