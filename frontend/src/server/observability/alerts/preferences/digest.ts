import "server-only";
import type {
  AlertCategory,
  AlertSeverity,
  AlertTriggerType,
  DigestCadence,
  DigestEntry,
  DigestSchedule,
} from "@/server/types";
import type { ChainFamily } from "@/lib/chainIdentity";

export type AppendDigestEntryInput = {
  alertId: string;
  walletAddress: string;
  chainFamily: ChainFamily;
  network: string;
  severity: AlertSeverity;
  category: AlertCategory;
  triggerType: AlertTriggerType;
  message: string;
  observedAt?: string;
};

/**
 * Pushes a single suppressed (non-critical) alert into a digest schedule,
 * keeping the entries ordered newest-first. Never mutates the caller's
 * object — returns a fresh schedule.
 */
export function appendDigestEntry(
  schedule: DigestSchedule,
  input: AppendDigestEntryInput,
  now: Date = new Date(),
): DigestSchedule {
  const entry: DigestEntry = {
    alertId: input.alertId,
    walletAddress: input.walletAddress,
    chainFamily: input.chainFamily,
    network: input.network,
    severity: input.severity,
    category: input.category,
    triggerType: input.triggerType,
    message: input.message,
    scheduledAt: now.toISOString(),
    observedAt: input.observedAt ?? now.toISOString(),
  };

  return {
    ...schedule,
    entries: [entry, ...schedule.entries],
  };
}

/**
 * Creates a fresh, empty digest schedule anchored to `now` for the wallet's
 * chain scope.
 */
export function emptyDigestSchedule(input: {
  walletAddress: string;
  chainFamily: ChainFamily;
  network: string;
  cadence: DigestCadence;
}): DigestSchedule {
  return {
    walletAddress: input.walletAddress,
    chainFamily: input.chainFamily,
    network: input.network,
    cadence: input.cadence,
    entries: [],
    nextSendAt: new Date().toISOString(),
  };
}

const CADENCE_MS: Record<Exclude<DigestCadence, "off">, number> = {
  hourly: 60 * 60 * 1000,
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
};

/**
 * Next scheduled send for a cadence, measured from `now`. When cadence is
 * "off" the digest is never scheduled (returns `null` to signal an inert
 * schedule).
 */
export function nextDigestSend(cadence: DigestCadence, now: Date = new Date()): string | null {
  if (cadence === "off") return null;
  const intervalMs = CADENCE_MS[cadence];
  return new Date(now.getTime() + intervalMs).toISOString();
}

/**
 * Groups digest entries by their wallet + chain scope.
 */
export function groupDigestByScope(entries: DigestEntry[]): Map<string, DigestEntry[]> {
  const grouped = new Map<string, DigestEntry[]>();
  for (const entry of entries) {
    const key = `${entry.walletAddress}::${entry.chainFamily}::${entry.network}`;
    const list = grouped.get(key) ?? [];
    list.push(entry);
    grouped.set(key, list);
  }
  return grouped;
}

/**
 * Compiles digest entries into a single flattened summary payload without
 * dropping any alert — the seat of the "digest aggregates suppressed alerts
 * without losing any" acceptance criterion.
 */
export function renderDigestSummary(entries: DigestEntry[]): {
  alertCount: number;
  severities: Record<AlertSeverity, number>;
  summaries: string[];
} {
  const severities: Record<AlertSeverity, number> = {
    low: 0,
    medium: 0,
    high: 0,
    critical: 0,
  };
  const summaries: string[] = [];

  for (const entry of entries) {
    severities[entry.severity] += 1;
    summaries.push(`${entry.severity.toUpperCase()} · ${entry.message}`);
  }

  return {
    alertCount: entries.length,
    severities,
    summaries,
  };
}
