import { createHash } from "node:crypto";
import {
  parseRiskSnapshotDocument,
  type RiskSnapshotAsset,
  type RiskSnapshotDocument,
} from "./schema";

function compareCodePoints(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function normalizeJson(value: unknown): unknown {
  if (typeof value === "string") return value.normalize("NFC");
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("Snapshot numbers must be finite.");
    return Object.is(value, -0) ? 0 : value;
  }
  if (typeof value === "boolean" || value === null) return value;
  if (Array.isArray(value)) return value.map(normalizeJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => compareCodePoints(left, right))
        .map(([key, item]) => [key.normalize("NFC"), normalizeJson(item)]),
    );
  }
  throw new TypeError(`Unsupported snapshot value: ${typeof value}`);
}

export function canonicalizeJson(value: unknown): string {
  return JSON.stringify(normalizeJson(value));
}

export function canonicalAssetIdentity(asset: RiskSnapshotAsset): string {
  const network = asset.network.trim().toLowerCase();
  const { identity } = asset;
  const canonicalId = normalizeCanonicalId(asset);

  return `${asset.chainFamily}:${network}:${identity.kind}:${canonicalId}`;
}

function normalizeCanonicalId(asset: RiskSnapshotAsset): string {
  const { identity } = asset;
  const canonicalId = identity.canonicalId.trim();
  if (identity.kind === "evm_contract") return canonicalId.toLowerCase();
  if (identity.kind.startsWith("stellar_") || identity.kind === "soroban_contract") return canonicalId.toUpperCase();
  return canonicalId.toUpperCase();
}

export function normalizeRiskSnapshotDocument(value: unknown): RiskSnapshotDocument {
  const parsed = parseRiskSnapshotDocument(value);
  const evidence = [...parsed.evidence]
    .map((item) => ({ ...item, label: item.label.normalize("NFC") }))
    .sort((left, right) => compareCodePoints(
      `${left.label}\u0000${left.url ?? ""}\u0000${left.checkedAt ?? ""}`,
      `${right.label}\u0000${right.url ?? ""}\u0000${right.checkedAt ?? ""}`,
    ));
  const missingData = [...parsed.missingData].sort((left, right) =>
    compareCodePoints(`${left.field}\u0000${left.impact}`, `${right.field}\u0000${right.impact}`));
  const sourceCheckedAt = [...new Set(parsed.freshness.sourceCheckedAt)].sort(compareCodePoints);

  return parseRiskSnapshotDocument(normalizeJson({
    ...parsed,
    asset: {
      ...parsed.asset,
      network: parsed.asset.network.trim().toLowerCase(),
      identity: {
        ...parsed.asset.identity,
        canonicalId: normalizeCanonicalId(parsed.asset),
        contractAddress: parsed.asset.identity.kind === "evm_contract"
          ? parsed.asset.identity.contractAddress?.toLowerCase()
          : parsed.asset.identity.contractAddress?.toUpperCase(),
        assetCode: parsed.asset.identity.assetCode?.toUpperCase(),
        issuer: parsed.asset.identity.issuer?.toUpperCase(),
      },
      symbol: parsed.asset.symbol.toUpperCase(),
    },
    evidence,
    missingData,
    freshness: { ...parsed.freshness, sourceCheckedAt },
  }));
}

export function hashRiskSnapshot(value: unknown): string {
  const canonical = canonicalizeJson(normalizeRiskSnapshotDocument(value));
  return `sha256:${createHash("sha256").update(canonical, "utf8").digest("hex")}`;
}
