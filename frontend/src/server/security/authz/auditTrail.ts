import type { Capability } from "./capabilities";
import type { AuthzResource } from "./ownership";
import type { AuthzSubject } from "./subject";

export type AuthzAuditEntry = {
  id: string;
  at: string;
  subjectHash: string;
  subjectKind: AuthzSubject["kind"];
  capability: Capability;
  resourceId?: string;
  resourceScope?: { chainFamily?: "evm" | "stellar"; network?: string };
  decision: "allow" | "deny";
  reason: string;
};

const entries: AuthzAuditEntry[] = [];

export function appendAuthzAudit(input: Omit<AuthzAuditEntry, "id" | "at">, now = new Date()) {
  const entry = { ...input, id: `authz_${entries.length + 1}`, at: now.toISOString() };
  entries.push(Object.freeze(entry));
  return entry;
}

export function recordAuthzDecision(input: { subject: AuthzSubject; capability: Capability; resource: AuthzResource; decision: "allow" | "deny"; reason: string }) {
  return appendAuthzAudit({
    subjectHash: input.subject.walletHash,
    subjectKind: input.subject.kind,
    capability: input.capability,
    resourceId: input.resource.id,
    resourceScope: { chainFamily: input.resource.chainFamily, network: input.resource.network?.trim().toLowerCase() },
    decision: input.decision,
    reason: input.reason,
  });
}

export function listAuthzAuditEntries() {
  return entries.map((entry) => ({ ...entry, resourceScope: entry.resourceScope ? { ...entry.resourceScope } : undefined }));
}

export function clearAuthzAuditForTests() {
  entries.splice(0, entries.length);
}
