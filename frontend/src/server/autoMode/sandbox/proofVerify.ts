import { deterministicHash } from "@/server/evaluation/harness/determinism";
import { hashAutoModePolicy, type AutoModePolicy } from "@/server/autoMode/policy";
import type { GuardrailProof } from "./guardrailProof";

export type ProofVerification = { valid: true } | { valid: false; reason: "proof_hash_mismatch" | "policy_hash_mismatch" | "constraint_hash_mismatch" };

export function verifyGuardrailProof(proof: GuardrailProof, policy?: AutoModePolicy): ProofVerification {
  const { proofHash, ...unsigned } = proof;
  if (deterministicHash(unsigned) !== proofHash) return { valid: false, reason: "proof_hash_mismatch" };
  if (policy && (hashAutoModePolicy(policy) !== proof.policyHash || policy.policyVersion !== proof.policyVersion)) return { valid: false, reason: "policy_hash_mismatch" };
  return { valid: true };
}
