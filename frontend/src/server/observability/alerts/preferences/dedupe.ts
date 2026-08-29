import "server-only";
import type { Alert, AlertObservation } from "@/server/types";

/**
 * Stable fingerprint of the underlying condition an alert is about: the
 * trigger type plus the observation key and the evidence identity. Two alerts
 * that share a fingerprint are considered "the same underlying condition".
 */
function conditionFingerprint(alert: Pick<Alert, "triggerType" | "observationKey">): string {
  return `${alert.triggerType}|${alert.observationKey ?? ""}`;
}

/**
 * Whether emitting another delivery for this condition should be suppressed
 * because an identical alert was already created within the window.
 *
 * `dedupeWindowMinutes` is the rolling window measured from `now`. When the
 * window is 0 (or absent) deduplication is disabled. Critical alerts are never
 * deduplicated away — the guarantee in the model means they must always be
 * able to fire so operators are never silently collapsed.
 */
export function isDuplicateInWindow(options: {
  alert: Pick<Alert, "triggerType" | "observationKey" | "severity" | "triggeredAt">;
  priorAlerts: Pick<Alert, "triggerType" | "observationKey" | "severity" | "triggeredAt">[];
  dedupeWindowMinutes: number;
  now?: Date;
}): boolean {
  const windowMinutes = Number.isFinite(options.dedupeWindowMinutes)
    ? Math.max(0, options.dedupeWindowMinutes)
    : 0;

  if (windowMinutes <= 0) return false;
  if (options.alert.severity === "critical") return false;

  const nowMs = (options.now ?? new Date()).getTime();
  const fingerprint = conditionFingerprint(options.alert);

  return options.priorAlerts.some((prior) => {
    if (prior.severity === "critical") return false;
    if (conditionFingerprint(prior) !== fingerprint) return false;

    const priorMs = new Date(prior.triggeredAt).getTime();
    if (!Number.isFinite(priorMs)) return false;

    return nowMs - priorMs <= windowMinutes * 60_000;
  });
}

/**
 * Observation-level dedupe: returns true when an identical observation
 * (same trigger key and value) was already seen within the window. Anchored
 * to the observation's own createdAt.
 */
export function isDuplicateObservationInWindow(options: {
  observation: Pick<AlertObservation, "triggerType" | "observationKey" | "value" | "createdAt">;
  priorObservations: Pick<AlertObservation, "triggerType" | "observationKey" | "value" | "createdAt">[];
  dedupeWindowMinutes: number;
  now?: Date;
}): boolean {
  const windowMinutes = Number.isFinite(options.dedupeWindowMinutes)
    ? Math.max(0, options.dedupeWindowMinutes)
    : 0;

  if (windowMinutes <= 0) return false;

  const nowMs = (options.now ?? new Date()).getTime();
  const { triggerType, observationKey, value } = options.observation;

  return options.priorObservations.some((prior) => {
    if (
      prior.triggerType !== triggerType ||
      prior.observationKey !== observationKey ||
      prior.value !== value
    ) {
      return false;
    }

    const priorMs = new Date(prior.createdAt).getTime();
    if (!Number.isFinite(priorMs)) return false;

    return nowMs - priorMs <= windowMinutes * 60_000;
  });
}
