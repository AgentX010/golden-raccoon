import "server-only";
import type {
  AlertCategory,
  AlertDeliveryChannel,
  AlertSeverity,
  AlertTriggerType,
  NotificationPreferences,
} from "@/server/types";
import type { ChainFamily } from "@/lib/chainIdentity";

export const ALERT_CHANNELS: readonly AlertDeliveryChannel[] = [
  "in_app",
  "email",
  "telegram",
  "discord",
] as const;

export const ALERT_SEVERITIES: readonly AlertSeverity[] = [
  "low",
  "medium",
  "high",
  "critical",
] as const;

const SEVERITY_RANK: Record<AlertSeverity, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

/**
 * Total ordering over alert severities. `low` < `medium` < `high` < `critical`.
 */
export function severityRank(severity: AlertSeverity): number {
  return SEVERITY_RANK[severity] ?? 0;
}

/**
 * A severity is "at or above" a threshold when its rank is >= the threshold's.
 * The comparison is inclusive so `minimumSeverity: "high"` includes high and
 * critical.
 */
export function meetsMinimumSeverity(severity: AlertSeverity, minimum: AlertSeverity): boolean {
  return severityRank(severity) >= severityRank(minimum);
}

const TRIGGER_CATEGORY: Record<AlertTriggerType, AlertCategory> = {
  critical_risk: "critical_risk",
  liquidity_drop: "liquidity",
  holder_concentration_change: "ownership",
  tax_control_change: "ownership",
  phishing_detected: "security",
  exploit_news: "security",
  portfolio_concentration: "portfolio",
  stable_reserve_change: "portfolio",
  stellar_issuer_auth: "stellar",
  stellar_clawback: "stellar",
  stellar_trustline: "stellar",
  stellar_contract_ttl: "stellar",
  rpc_degradation: "infrastructure",
};

/**
 * Stable mapping from an alert trigger to its coarse delivery category.
 */
export function categoryForTrigger(trigger: AlertTriggerType): AlertCategory {
  return TRIGGER_CATEGORY[trigger] ?? "critical_risk";
}

/**
 * Returns every channel the wallet has not explicitly disabled. A channel
 * preference that is absent from the map is treated as disabled.
 */
export function enabledChannels(preferences: NotificationPreferences): AlertDeliveryChannel[] {
  return ALERT_CHANNELS.filter(
    (channel) => preferences.channels[channel]?.enabled === true,
  );
}

/**
 * A category is opted in on a channel unless it is explicitly set to false.
 * Absent entries (which is the default) opt in — matching the mental model of
 * "rule everything on unless I opt out".
 */
export function categoryOptedIn(
  preference: { categories?: Partial<Record<AlertCategory, boolean>> } | undefined,
  category: AlertCategory,
): boolean {
  if (!preference) return true;
  return preference.categories?.[category] !== false;
}

/**
 * Default preferences. All channels enabled with a permissive minimum
 * severity, quiet hours off, digest off, and a 30 minute dedupe window.
 */
export function defaultNotificationPreferences(input: {
  walletAddress: string;
  chainFamily: ChainFamily;
  network: string;
}): NotificationPreferences {
  const channels = {} as NotificationPreferences["channels"];
  for (const channel of ALERT_CHANNELS) {
    channels[channel] = {
      enabled: true,
      minimumSeverity: "low",
    };
  }

  return {
    walletAddress: input.walletAddress,
    chainFamily: input.chainFamily,
    network: input.network,
    channels,
    quietHours: {
      enabled: false,
      start: "22:00",
      end: "07:00",
      timeZone: "UTC",
    },
    digestCadence: "off",
    dedupeWindowMinutes: 30,
    updatedAt: new Date().toISOString(),
  };
}
