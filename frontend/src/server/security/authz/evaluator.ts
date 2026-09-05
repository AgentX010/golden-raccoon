import type { Capability } from "./capabilities";
import { ownsResource, matchesScope, type AuthzResource } from "./ownership";
import { recordAuthzDecision } from "./auditTrail";
import type { AuthzSubject } from "./subject";

export type AuthzDecision = { allowed: true; reason: "allowed"; capability: Capability } | { allowed: false; reason: "anonymous" | "resource_owner_mismatch" | "scope_mismatch" | "server_signing_forbidden" | "capability_denied"; capability: Capability };

export function evaluateCapability(subject: AuthzSubject, capability: Capability, resource: AuthzResource = {}): AuthzDecision {
  let decision: AuthzDecision;
  if (resource.serverSigning) decision = { allowed: false, reason: "server_signing_forbidden", capability };
  else if (subject.kind === "anonymous") decision = { allowed: false, reason: "anonymous", capability };
  else if (!ownsResource(subject, resource)) decision = { allowed: false, reason: "resource_owner_mismatch", capability };
  else if (!matchesScope(subject, resource)) decision = { allowed: false, reason: "scope_mismatch", capability };
  else decision = { allowed: true, reason: "allowed", capability };
  recordAuthzDecision({ subject, capability, resource, decision: decision.allowed ? "allow" : "deny", reason: decision.reason });
  return decision;
}
