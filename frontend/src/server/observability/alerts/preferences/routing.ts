import "server-only";
import type {
  Alert,
  AlertCategory,
  AlertDeliveryChannel,
  DeliveryPlan,
  NotificationPreferences,
} from "@/server/types";
import type { ChainFamily } from "@/lib/chainIdentity";
import {
  categoryForTrigger,
  categoryOptedIn,
  meetsMinimumSeverity,
} from "./model";
import { isWithinQuietHours } from "./quietHours";

export type RouteAlertOptions = {
  now?: Date;
  digestEnabled?: boolean;
  chainFamily?: ChainFamily;
  network?: string;
};

const REASON_KEYS: readonly AlertDeliveryChannel[] = [
  "in_app",
  "email",
  "telegram",
  "discord",
] as const;

/**
 * The routing evaluator: turns an alert plus the wallet's typed preferences
 * into a concrete `DeliveryPlan`.
 *
 * Rules, in priority order:
 *  1. The channel must be enabled.
 *  2. The alert severity must meet the channel's minimum severity.
 *  3. The alert's category must be opted in on the channel.
 *  4. If the alert is non-critical and quiet hours are active, the channel is
 *     suppressed into the digest stream (when digest is enabled) rather than
 *     delivered now.
 *
 * GUARANTEE (model.ts): critical alerts always bypass quiet hours and digest
 * batching. They are delivered immediately on every enabled channel that
 * meets their severity and category, exactly as if quiet hours were off.
 */
export function routeAlert(
  alert: Pick<Alert, "id" | "walletAddress" | "severity" | "triggerType" | "observationKey" | "triggeredAt">,
  preferences: NotificationPreferences,
  options: RouteAlertOptions = {},
): DeliveryPlan {
  const now = options.now ?? new Date();
  const category: AlertCategory = categoryForTrigger(alert.triggerType);
  const isCritical = alert.severity === "critical";
  const inQuietHours = isWithinQuietHours(preferences.quietHours, now);
  const digestEnabled = options.digestEnabled ?? preferences.digestCadence !== "off";
  const suppressedForDigest = !isCritical && inQuietHours && digestEnabled;

  const chainFamily: ChainFamily = options.chainFamily ?? preferences.chainFamily;
  const network: string = options.network ?? preferences.network;

  const deliverNow: AlertDeliveryChannel[] = [];
  const suppressedReasons = {} as DeliveryPlan["suppressedReasons"];

  for (const channel of REASON_KEYS) {
    const channelPref = preferences.channels?.[channel];
    if (!channelPref?.enabled) {
      suppressedReasons[channel] = "channel disabled";
      continue;
    }
    if (!meetsMinimumSeverity(alert.severity, channelPref.minimumSeverity)) {
      suppressedReasons[channel] = `below minimum severity (${channelPref.minimumSeverity})`;
      continue;
    }
    if (!categoryOptedIn(channelPref, category)) {
      suppressedReasons[channel] = `category ${category} opted out`;
      continue;
    }

    if (suppressedForDigest) {
      suppressedReasons[channel] = "quiet hours; routed to digest";
      continue;
    }

    deliverNow.push(channel);
  }

  return {
    alertId: alert.id,
    walletAddress: alert.walletAddress,
    chainFamily,
    network,
    severity: alert.severity,
    category,
    triggerType: alert.triggerType,
    deliverNow,
    toDigest: suppressedForDigest,
    suppressedReasons,
  };
}
