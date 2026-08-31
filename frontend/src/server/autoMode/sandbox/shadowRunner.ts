import { evaluateAutoModeBuyDecision, hashAutoModePolicy, type AutoModeBuyContext, type AutoModePolicy } from "@/server/autoMode/policy";
import { getKillSwitchState, type KillSwitchScope, type KillSwitchStore, killSwitchStore } from "./killSwitch";
import { createGuardrailProof, type GuardrailProof } from "./guardrailProof";

export type ShadowCandidate = AutoModeBuyContext & KillSwitchScope & { id?: string };
export type ShadowEvaluation = { allowed: boolean; blockers: string[]; bindingConstraint?: string; proof: GuardrailProof; killSwitch: Awaited<ReturnType<typeof getKillSwitchState>>; sideEffects: "none" };

export async function evaluateShadowAction(policy: AutoModePolicy, candidate: ShadowCandidate, options: { store?: KillSwitchStore } = {}): Promise<ShadowEvaluation> {
  const killSwitch = await getKillSwitchState(candidate, options.store ?? killSwitchStore);
  const decision = evaluateAutoModeBuyDecision(policy, candidate);
  const scoped = candidate.chainFamily === "stellar" ? "stellar" : "evm";
  const proof = createGuardrailProof({ policy, context: candidate, decision, chainFamily: scoped, network: candidate.network });
  const blockers = killSwitch.engaged ? ["kill_switch_engaged", ...decision.blockers] : decision.blockers;
  return { allowed: !killSwitch.engaged && decision.allowed, blockers: [...new Set(blockers)], bindingConstraint: blockers[0], proof: { ...proof, allowed: !killSwitch.engaged && decision.allowed }, killSwitch, sideEffects: "none" };
}

export function shadowPolicyIdentity(policy: AutoModePolicy) {
  return { policyVersion: policy.policyVersion, policyHash: hashAutoModePolicy(policy) };
}
