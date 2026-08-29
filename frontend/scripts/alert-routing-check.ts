/**
 * Notification preferences & delivery routing fixture check (issue #152).
 *
 *   cd frontend && npm run test:alert-routing
 *
 * Drives a deterministic fixture alert stream spanning severities and
 * categories across a quiet-hours boundary and asserts the delivery plan and
 * digest contents exactly. Covers:
 *   - minimum severity suppression per channel
 *   - quiet hours suppress non-critical, never critical
 *   - digest batching aggregates suppressed alerts without losing any
 *   - repeated identical conditions dedupe within the configured window
 *   - preferences scoped per wallet + chain family + network
 *   - the documented critical-bypass guarantee
 */

import {
  defaultNotificationPreferences,
  enabledChannels,
  meetsMinimumSeverity,
  categoryForTrigger,
  categoryOptedIn,
  severityRank,
} from "../src/server/observability/alerts/preferences/model";
import { routeAlert, type RouteAlertOptions } from "../src/server/observability/alerts/preferences/routing";
import {
  isWithinQuietHours,
  currentMinuteOfDay,
} from "../src/server/observability/alerts/preferences/quietHours";
import {
  isDuplicateInWindow,
  isDuplicateObservationInWindow,
} from "../src/server/observability/alerts/preferences/dedupe";
import {
  appendDigestEntry,
  emptyDigestSchedule,
  groupDigestByScope,
  nextDigestSend,
  renderDigestSummary,
} from "../src/server/observability/alerts/preferences/digest";
import { upsertNotificationPreferences, getNotificationPreferences, listNotificationPreferences } from "../src/server/storage";
import type { Alert, NotificationPreferences, AlertDeliveryChannel } from "../src/server/types";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const WALLET = "0xroutingfixturewallet000000000000000001";
const EVM = "evm" as const;
const NETWORK = "ethereum" as const;

function baseAlert(overrides: Partial<Alert> = {}): Alert {
  const base: Alert = {
    id: `alert_fixture_${Math.random().toString(36).slice(2, 8)}`,
    walletAddress: WALLET,
    ruleId: "rule_fixture",
    triggerType: "critical_risk",
    observationKey: "onchain:fixture",
    status: "triggered",
    severity: "high",
    message: "Critical risk reached 90 (onchain:fixture).",
    beforeValue: 40,
    afterValue: 90,
    evidenceBefore: { runId: "run_before", agent: "onchain", label: "before", detail: "prior", sourceLabels: ["GoPlus"] },
    evidenceAfter: { runId: "run_after", agent: "onchain", label: "after", detail: "now", sourceLabels: ["GoPlus"] },
    evidenceData: {
      runId: "run_after",
      observationId: "obs_after",
      evidenceAfterObservationId: "obs_after",
      sourceSnapshotHashAfter: "snap_after",
      evidenceAfterHash: "evh_after",
      deteriorationObservationIds: ["obs_after"],
    },
    triggeredAt: new Date().toISOString(),
  };
  return { ...base, ...overrides };
}

function defaultPrefs(): NotificationPreferences {
  return defaultNotificationPreferences({ walletAddress: WALLET, chainFamily: EVM, network: NETWORK });
}

function makeDate(hour: number, minute = 0): Date {
  const d = new Date(2026, 7, 29, hour, minute, 0, 0);
  return d;
}

function testMinimumSeverity() {
  const prefs = defaultPrefs();
  prefs.channels.email = { enabled: true, minimumSeverity: "high" };
  prefs.channels.telegram = { enabled: true, minimumSeverity: "critical" };

  const low = routeAlert(baseAlert({ severity: "low" }), prefs, { chainFamily: EVM, network: NETWORK });
  assert(!low.deliverNow.includes("email"), "email (min high) must not receive a low alert.");
  assert(!low.deliverNow.includes("telegram"), "telegram (min critical) must not receive a low alert.");
  assert(low.deliverNow.includes("in_app"), "in_app (min low) must receive a low alert.");
  assert(low.suppressedReasons.email === "below minimum severity (high)", "email suppressed reason must explain minimum severity.");

  const high = routeAlert(baseAlert({ severity: "high" }), prefs, { chainFamily: EVM, network: NETWORK });
  assert(high.deliverNow.includes("email"), "email (min high) must receive a high alert.");
  assert(!high.deliverNow.includes("telegram"), "telegram (min critical) must not receive a high alert.");

  const critical = routeAlert(baseAlert({ severity: "critical" }), prefs, { chainFamily: EVM, network: NETWORK });
  assert(critical.deliverNow.includes("telegram"), "telegram (min critical) must receive a critical alert.");

  // Inclusive ordering helper sanity checks.
  assert(meetsMinimumSeverity("high", "high") === true, "high meets min high.");
  assert(meetsMinimumSeverity("medium", "high") === false, "medium does not meet min high.");
  assert(severityRank("low") < severityRank("critical"), "severity ordering is monotonic.");
}

function testQuietHoursBoundary() {
  const prefs = defaultPrefs();
  prefs.quietHours = { enabled: true, start: "22:00", end: "07:00", timeZone: "UTC" };

  // Inside quiet hours (23:00 UTC).
  assert(isWithinQuietHours(prefs.quietHours, makeDate(23, 0)) === true, "23:00 UTC must be inside quiet hours.");
  // Outside quiet hours (noon UTC).
  assert(isWithinQuietHours(prefs.quietHours, makeDate(12, 0)) === false, "12:00 UTC must be outside quiet hours.");
  // Cross-midnight boundary: 05:00 is inside, 07:00+ is outside.
  assert(isWithinQuietHours(prefs.quietHours, makeDate(5, 0)) === true, "05:00 UTC must be inside quiet hours.");
  assert(isWithinQuietHours(prefs.quietHours, makeDate(8, 0)) === false, "08:00 UTC must be outside quiet hours.");

  // Critical must bypass quiet hours.
  const quietRoute = routeAlert(baseAlert({ severity: "critical" }), prefs, {
    now: makeDate(23, 30),
    chainFamily: EVM,
    network: NETWORK,
    digestEnabled: true,
  });
  assert(quietRoute.toDigest === false, "critical alert must never be routed to digest.");
  assert(
    quietRoute.deliverNow.length > 0,
    "critical alert must deliver immediately even inside quiet hours (documented guarantee).",
  );

  // Non-critical inside quiet hours is suppressed, but not lost.
  const infoRoute = routeAlert(baseAlert({ severity: "low", triggerType: "stable_reserve_change" }), prefs, {
    now: makeDate(23, 30),
    chainFamily: EVM,
    network: NETWORK,
    digestEnabled: true,
  });
  assert(infoRoute.toDigest === true, "non-critical inside quiet hours must be routed to digest.");
  assert(
    infoRoute.deliverNow.length === 0,
    "non-critical inside quiet hours must not be delivered to any channel now.",
  );

  // Outside quiet hours the same alert delivers normally.
  const dayRoute = routeAlert(baseAlert({ severity: "low", triggerType: "stable_reserve_change" }), prefs, {
    now: makeDate(12, 0),
    chainFamily: EVM,
    network: NETWORK,
    digestEnabled: true,
  });
  assert(dayRoute.toDigest === false, "non-critical outside quiet hours must not be suppressed.");
  assert(dayRoute.deliverNow.length > 0, "non-critical outside quiet hours must deliver normally.");
}

function testTimezoneAwareQuietHours() {
  // 23:00 UTC is 18:00 America/New_York in August (EDT, UTC-4) — not quiet.
  const prefs = defaultPrefs();
  prefs.quietHours = { enabled: true, start: "20:00", end: "06:00", timeZone: "America/New_York" };
  const now = makeDate(23, 0);

  const minuteOfDayUtc = currentMinuteOfDay(now, "UTC");
  assert(minuteOfDayUtc === 23 * 60, "UTC minute-of-day sanity.");
  // EDT shift: 23:00 UTC == 19:00 local, outside 20:00-06:00.
  assert(isWithinQuietHours(prefs.quietHours, now) === false, "23:00 UTC (19:00 EDT) must not be inside NY quiet hours.");
}

function testCategoryOptOut() {
  const prefs = defaultPrefs();
  prefs.channels.email = { enabled: true, minimumSeverity: "low", categories: { security: false } };

  const phish = routeAlert(baseAlert({ severity: "high", triggerType: "phishing_detected" }), prefs, {
    chainFamily: EVM,
    network: NETWORK,
  });
  assert(!phish.deliverNow.includes("email"), "email with security category opted out must not receive phishing alert.");
  assert(phish.suppressedReasons.email === "category security opted out", "opted-out category must explain its suppression.");

  // Same alert still crosses the other channels.
  const otherChannels = totalDelivered(phish.deliverNow);
  assert(otherChannels >= 1, "phishing alert must still deliver to channels that did not opt out.");

  assert(categoryForTrigger("liquidity_drop") === "liquidity", "liquidity_drop maps to liquidity category.");
  assert(categoryOptedIn(undefined, "security") === true, "absent category map implies opt-in.");
}

function totalDelivered(channels: AlertDeliveryChannel[]): number {
  return channels.length;
}

function testDigestBatching() {
  // Build three suppressed alerts across the stream and assert the digest
  // aggregates every one without loss.
  const schedule = emptyDigestSchedule({
    walletAddress: WALLET,
    chainFamily: EVM,
    network: NETWORK,
    cadence: "daily",
  });

  const stream = [
    baseAlert({ severity: "low", triggerType: "stable_reserve_change", message: "Stable reserve drop" }),
    baseAlert({ severity: "medium", triggerType: "liquidity_drop", message: "Liquidity drop" }),
    baseAlert({ severity: "high", triggerType: "rpc_degradation", message: "Source degradation" }),
  ];

  let acc = schedule;
  for (let index = 0; index < stream.length; index += 1) {
    const alert = stream[index];
    acc = appendDigestEntry(acc, {
      alertId: alert.id,
      walletAddress: WALLET,
      chainFamily: EVM,
      network: NETWORK,
      severity: alert.severity,
      category: categoryForTrigger(alert.triggerType),
      triggerType: alert.triggerType,
      message: alert.message,
    });
  }

  // No alert lost: every id present once.
  const ids = acc.entries.map((entry) => entry.alertId);
  for (const alert of stream) {
    assert(ids.includes(alert.id), `digest must retain alert ${alert.id}`);
  }
  assert(acc.entries.length === stream.length, "digest must not drop any suppressed alert.");

  const summary = renderDigestSummary(acc.entries);
  assert(summary.alertCount === stream.length, "digest summary counts every suppressed alert.");
  assert(summary.severities.low === 1, "digest counts one low.");
  assert(summary.severities.medium === 1, "digest counts one medium.");
  assert(summary.severities.high === 1, "digest counts one high.");

  const grouped = groupDigestByScope(acc.entries);
  assert(grouped.size === 1, "all digest entries share one wallet+chain scope.");
  assert(grouped.has(`${WALLET}::${EVM}::${NETWORK}`), "scope key uses wallet::family::network.");

  assert(nextDigestSend("off", makeDate(12)) === null, "off cadence never schedules a digest.");
  assert(nextDigestSend("daily", makeDate(12)) !== null, "daily cadence schedules a digest.");
}

function testDedup() {
  const now = makeDate(12, 0);
  const prior = [baseAlert({ triggeredAt: new Date(now.getTime() - 5 * 60_000).toISOString() })];

  assert(
    isDuplicateInWindow({
      alert: baseAlert({ triggeredAt: now.toISOString() }),
      priorAlerts: prior,
      dedupeWindowMinutes: 30,
      now,
    }) === true,
    "identical condition within window must dedupe.",
  );

  assert(
    isDuplicateInWindow({
      alert: baseAlert({ triggeredAt: now.toISOString() }),
      priorAlerts: prior,
      dedupeWindowMinutes: 1,
      now,
    }) === false,
    "condition outside the window must not dedupe.",
  );

  // Critical never dedupes away.
  assert(
    isDuplicateInWindow({
      alert: baseAlert({ severity: "critical", triggeredAt: now.toISOString() }),
      priorAlerts: [baseAlert({ severity: "critical", triggeredAt: new Date(now.getTime() - 1000).toISOString() })],
      dedupeWindowMinutes: 30,
      now,
    }) === false,
    "critical alerts must never be deduplicated.",
  );

  assert(
    isDuplicateObservationInWindow({
      observation: { triggerType: "liquidity_drop", observationKey: "k", value: 10, createdAt: now.toISOString() },
      priorObservations: [{ triggerType: "liquidity_drop", observationKey: "k", value: 10, createdAt: new Date(now.getTime() - 1000).toISOString() }],
      dedupeWindowMinutes: 30,
      now,
    }) === true,
    "identical observation within window must dedupe.",
  );
}

function testScopeIsolation() {
  const walletA = defaultPrefs();
  walletA.channels.email = { enabled: false, minimumSeverity: "low" };
  const savedA = upsertNotificationPreferences(walletA);

  const walletB = defaultNotificationPreferences({ walletAddress: "0xroutingfixturewallet000000000000000002", chainFamily: EVM, network: NETWORK });
  const savedB = upsertNotificationPreferences(walletB);

  assert(savedA.id !== savedB.id, "each scope mints its own preference id.");

  const fetchedB = getNotificationPreferences({
    walletAddress: "0xroutingfixturewallet000000000000000002",
    chainFamily: EVM,
    network: NETWORK,
  });
  assert(fetchedB?.channels.email?.enabled === true, "wallet B must be isolated from wallet A's email opt-out.");

  const listForA = listNotificationPreferences(walletA.walletAddress);
  assert(listForA.length === 1, "listing by wallet returns only that wallet's preferences.");

  // Same wallet, different chain family → isolated scope.
  const sameWalletStellar = defaultNotificationPreferences({ walletAddress: walletA.walletAddress, chainFamily: "stellar", network: "stellar-testnet" });
  const savedStellar = upsertNotificationPreferences(sameWalletStellar);
  assert(savedStellar.id !== savedA.id, "same wallet on a different chain scope must be isolated.");
  const fetchedStellar = getNotificationPreferences({ walletAddress: walletA.walletAddress, chainFamily: "stellar", network: "stellar-testnet" });
  assert(fetchedStellar?.chainFamily === "stellar", "stellar-scoped preferences round-trip.");
}

function testPlanShape() {
  const prefs = defaultPrefs();
  const options: RouteAlertOptions = { chainFamily: EVM, network: NETWORK };
  const plan = routeAlert(baseAlert(), prefs, options);
  assert(plan.alertId.length > 0, "plan carries alert id.");
  assert(plan.chainFamily === EVM && plan.network === NETWORK, "plan carries the scope.");
  assert(Array.isArray(plan.deliverNow), "plan.deliverNow is an array.");
  assert(plan.suppressedReasons && typeof plan.suppressedReasons === "object", "plan carries per-channel reasons.");
  assert(enabledChannels(prefs).length === 4, "default preferences enable all channels.");
}

async function main() {
  const tests = [
    ["minimum severity routing", testMinimumSeverity],
    ["quiet hours boundary + critical bypass", testQuietHoursBoundary],
    ["timezone-aware quiet hours", testTimezoneAwareQuietHours],
    ["category opt-out", testCategoryOptOut],
    ["digest batching", testDigestBatching],
    ["dedupe window", testDedup],
    ["scope isolation", testScopeIsolation],
    ["plan shape", testPlanShape],
  ] as const;

  for (const [name, run] of tests) {
    await run();
    console.log(`ok - ${name}`);
  }

  console.log(`alert-routing-check: ${tests.length} fixtures passed`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
