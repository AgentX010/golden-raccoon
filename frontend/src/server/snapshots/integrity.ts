import { createHash, timingSafeEqual } from "node:crypto";
import { canonicalAssetIdentity, hashRiskSnapshot, normalizeRiskSnapshotDocument } from "./canonical";
import {
  SUPPORTED_RISK_SNAPSHOT_VERSIONS,
  type PublicRiskSnapshot,
  type RiskSnapshotRecord,
} from "./schema";

export type RiskSnapshotIntegrityFailure = {
  ok: false;
  code: "unknown_version" | "expired" | "revoked" | "tampered" | "identity_collision";
  detail: string;
};

export type RiskSnapshotIntegrityResult =
  | { ok: true; snapshot: PublicRiskSnapshot }
  | RiskSnapshotIntegrityFailure;

function equalSecret(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

export function hashRevocationToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function verifyRevocationToken(record: RiskSnapshotRecord, token: string): boolean {
  return token.length >= 32 && equalSecret(record.revocationTokenHash, hashRevocationToken(token));
}

export function verifyRiskSnapshotRecord(
  record: RiskSnapshotRecord,
  now: number = Date.now(),
): RiskSnapshotIntegrityResult {
  const documentVersion = (record.snapshot as unknown as { schemaVersion?: unknown })?.schemaVersion;
  if (!SUPPORTED_RISK_SNAPSHOT_VERSIONS.has(record.schemaVersion) ||
      typeof documentVersion !== "string" ||
      !SUPPORTED_RISK_SNAPSHOT_VERSIONS.has(documentVersion)) {
    return { ok: false, code: "unknown_version", detail: "This snapshot uses an unsupported schema version." };
  }
  if (record.revokedAt) {
    return { ok: false, code: "revoked", detail: "This snapshot was revoked by its creator." };
  }
  const expiry = Date.parse(record.expiresAt);
  if (!Number.isFinite(expiry) || expiry <= now) {
    return { ok: false, code: "expired", detail: "This snapshot has expired." };
  }

  try {
    const document = normalizeRiskSnapshotDocument(record.snapshot);
    if (document.expiresAt !== record.expiresAt || document.schemaVersion !== record.schemaVersion) {
      return { ok: false, code: "tampered", detail: "Snapshot metadata does not match its signed content." };
    }
    if (!equalSecret(record.canonicalHash, hashRiskSnapshot(document))) {
      return { ok: false, code: "tampered", detail: "Snapshot content no longer matches its canonical hash." };
    }
    if (!equalSecret(record.identityKey, canonicalAssetIdentity(document.asset))) {
      return { ok: false, code: "identity_collision", detail: "Snapshot asset identity does not match its storage identity." };
    }
    return {
      ok: true,
      snapshot: {
        id: record.id,
        schemaVersion: record.schemaVersion,
        canonicalHash: record.canonicalHash,
        createdAt: record.createdAt,
        expiresAt: record.expiresAt,
        revokedAt: record.revokedAt,
        document,
      },
    };
  } catch {
    return { ok: false, code: "tampered", detail: "Snapshot content failed schema or integrity validation." };
  }
}
