/**
 * Local verification for the audit bundle. Recomputes the canonical hash and
 * checks structural invariants so a downloaded bundle can be independently
 * validated (e.g. by a reviewer) without trusting the exporter.
 */

import {
  AUDIT_BUNDLE_VERSION,
  buildAuditBundleHash,
  type AuditBundle,
} from "./auditBundle";

export interface AuditVerificationIssue {
  code: "unsupported_version" | "hash_mismatch" | "invalid_scope" | "invalid_section";
  detail: string;
}

export interface AuditVerificationResult {
  valid: boolean;
  issues: AuditVerificationIssue[];
  computedHash: string;
}

const HEX64 = /^[0-9a-f]{64}$/;

/** Verify a bundle against an expected hash. Unknown versions fail closed. */
export function verifyAuditBundle(
  bundle: AuditBundle,
  expectedHash?: string,
): AuditVerificationResult {
  const issues: AuditVerificationIssue[] = [];

  if (bundle.version !== AUDIT_BUNDLE_VERSION) {
    issues.push({
      code: "unsupported_version",
      detail: `Unsupported bundle version ${String(bundle.version)} (expected ${AUDIT_BUNDLE_VERSION}).`,
    });
  }

  const walletHash = bundle.scope?.walletHash ?? "";
  if (!HEX64.test(walletHash)) {
    issues.push({
      code: "invalid_scope",
      detail: "Bundle scope must contain a 64-char hex wallet hash.",
    });
  }

  if (!Array.isArray(bundle.decisions) || !Array.isArray(bundle.approvals) || !Array.isArray(bundle.transactions)) {
    issues.push({
      code: "invalid_section",
      detail: "Bundle must contain decisions, approvals, and transactions arrays.",
    });
  }

  const computedHash = buildAuditBundleHash(bundle);

  if (expectedHash && expectedHash !== computedHash) {
    issues.push({
      code: "hash_mismatch",
      detail: "Bundle hash does not match the expected value — content changed or was tampered with.",
    });
  }

  return { valid: issues.length === 0, issues, computedHash };
}
