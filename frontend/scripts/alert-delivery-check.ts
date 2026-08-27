/**
 * Alert delivery adapter fixture check.
 *
 *   cd frontend && npm run test:alert-delivery
 *
 * Uses deterministic fake transports only — never calls live email, Telegram,
 * or Discord services. Covers timeout, 429, 5xx, malformed success, permanent
 * 4xx, cancellation, duplicate idempotency, bounded retry, and HMAC verify.
 */

import {
  createAlert,
  createAlertDelivery,
  createAlertObservation,
  listAlertDeliveries,
  updateAlertDelivery,
  upsertAlertRule,
} from "../src/server/storage";
import {
  buildDeliveryIdempotencyKey,
  deliverAlertToChannel,
  findDeliveryByIdempotencyKey,
  persistDeliveryResult,
  retryAlertDelivery,
} from "../src/server/observability/alertDeliveries";
import {
  HttpTransportError,
  resetAlertDeliveryTransport,
  setAlertDeliveryTransport,
  type AlertHttpTransport,
  type HttpRequest,
  type HttpResponse,
} from "../src/server/observability/delivery/http";
import {
  signEmailWebhookPayload,
  verifyEmailWebhookSignature,
} from "../src/server/observability/delivery/email";
import { buildSanitizedAlertPayload, sanitizeDeliveryErrorDetail } from "../src/server/observability/alertSanitize";
import { fanOutDeliveries } from "../src/server/observability/alertEngine";
import type { Alert, AlertDelivery } from "../src/server/types";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const WALLET = "0xdeliveryfixturewallet000000000000000001";

function samplePayload(): AlertDelivery["sanitizedPayload"] {
  return {
    triggerType: "critical_risk",
    severity: "high",
    summary: "Critical risk reached 90 (onchain:fixture).",
    beforeValue: 40,
    afterValue: 90,
    observationKey: "onchain:fixture",
    evidenceLinks: ["agent-run:run_fixture"],
    walletHint: "wallet:…0001",
  };
}

function makeAlert(): Alert {
  const rule = upsertAlertRule({
    id: `rule_delivery_${Math.random().toString(36).slice(2, 8)}`,
    walletAddress: WALLET,
    triggerType: "critical_risk",
    threshold: 75,
    hysteresis: 5,
    cooldownMinutes: 0,
    direction: "high_is_bad",
    severity: "high",
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  return createAlert({
    walletAddress: WALLET,
    ruleId: rule.id,
    triggerType: "critical_risk",
    observationKey: "onchain:fixture",
    status: "triggered",
    severity: "high",
    message: "Critical risk reached 90 (onchain:fixture).",
    beforeValue: 40,
    afterValue: 90,
    evidenceBefore: {
      runId: "run_before",
      agent: "onchain",
      label: "before",
      detail: "prior",
      sourceLabels: ["GoPlus"],
    },
    evidenceAfter: {
      runId: "run_after",
      agent: "onchain",
      label: "after",
      detail: "now",
      sourceLabels: ["GoPlus"],
    },
    evidenceData: {
      runId: "run_after",
      observationId: "obs_after",
      evidenceAfterObservationId: "obs_after",
      sourceSnapshotHashAfter: "snap_after",
      evidenceAfterHash: "evh_after",
      deteriorationObservationIds: ["obs_after"],
    },
  });
}

function jsonResponse(status: number, body: unknown): HttpResponse {
  return {
    status,
    headers: { "content-type": "application/json" },
    bodyText: JSON.stringify(body),
  };
}

function installScriptedTransport(handler: AlertHttpTransport): void {
  setAlertDeliveryTransport(handler);
}

function withEnv(vars: Record<string, string | undefined>, run: () => Promise<void>): Promise<void> {
  const previous: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(vars)) {
    previous[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  return run().finally(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    resetAlertDeliveryTransport();
  });
}

async function testEmailHmacAndSuccess() {
  await withEnv(
    {
      ALERT_EMAIL_WEBHOOK_URL: "https://hooks.example.test/email",
      ALERT_EMAIL_WEBHOOK_SECRET: "fixture-secret",
      ALERT_DELIVERY_BACKOFF_MS: "0",
    },
    async () => {
      let seen: HttpRequest | undefined;
      installScriptedTransport(async (request) => {
        seen = request;
        return jsonResponse(200, { ok: true, id: "email_msg_1" });
      });

      const alert = makeAlert();
      const result = await deliverAlertToChannel("email", samplePayload(), alert, {
        idempotencyKey: "idem_email_ok",
        withRetry: false,
      });

      assert(result.status === "delivered", "Email adapter must deliver on validated 2xx.");
      assert(result.providerMessageId === "email_msg_1", "Email adapter must capture provider message id.");
      assert(seen?.headers?.["x-alert-signature"]?.startsWith("sha256="), "Email adapter must send HMAC signature.");
      const timestamp = seen?.headers?.["x-alert-timestamp"] ?? "";
      const signature = (seen?.headers?.["x-alert-signature"] ?? "").replace(/^sha256=/, "");
      assert(
        verifyEmailWebhookSignature("fixture-secret", timestamp, seen?.body ?? "", signature),
        "Email webhook signature must be verifiable.",
      );
      assert(
        signEmailWebhookPayload("fixture-secret", timestamp, seen?.body ?? "") === signature,
        "signEmailWebhookPayload must match the outbound signature.",
      );
    },
  );
}

async function testTelegramValidation() {
  await withEnv(
    {
      ALERT_TELEGRAM_BOT_TOKEN: "123456:FAKE_TELEGRAM_TOKEN_FOR_FIXTURE_ONLY",
      ALERT_TELEGRAM_CHAT_ID: "999001",
      ALERT_DELIVERY_BACKOFF_MS: "0",
    },
    async () => {
      installScriptedTransport(async () => jsonResponse(200, { ok: true, result: { message_id: 42 } }));
      const alert = makeAlert();
      const ok = await deliverAlertToChannel("telegram", samplePayload(), alert, {
        idempotencyKey: "idem_tg_ok",
        withRetry: false,
      });
      assert(ok.status === "delivered" && ok.providerMessageId === "42", "Telegram must require ok+message_id.");

      installScriptedTransport(async () => jsonResponse(200, { ok: false, description: "Bad Request" }));
      const malformed = await deliverAlertToChannel("telegram", samplePayload(), alert, {
        idempotencyKey: "idem_tg_malformed",
        withRetry: false,
      });
      assert(malformed.status === "failed" && malformed.terminal, "Malformed Telegram success must be terminal failed.");
    },
  );
}

async function testDiscordValidation() {
  await withEnv(
    {
      ALERT_DISCORD_WEBHOOK_URL: "https://discord.example.test/api/webhooks/1/token",
      ALERT_DELIVERY_BACKOFF_MS: "0",
    },
    async () => {
      installScriptedTransport(async () => ({ status: 204, headers: {}, bodyText: "" }));
      const alert = makeAlert();
      const ok = await deliverAlertToChannel("discord", samplePayload(), alert, {
        idempotencyKey: "idem_discord_ok",
        withRetry: false,
      });
      assert(ok.status === "delivered", "Discord 204 must count as delivered.");

      installScriptedTransport(async () => jsonResponse(200, { id: null }));
      const malformed = await deliverAlertToChannel("discord", samplePayload(), alert, {
        idempotencyKey: "idem_discord_malformed",
        withRetry: false,
      });
      assert(malformed.status === "failed" && malformed.terminal, "Malformed Discord body must be terminal failed.");
    },
  );
}

async function testRetryableAndTerminalFailures() {
  await withEnv(
    {
      ALERT_DISCORD_WEBHOOK_URL: "https://discord.example.test/api/webhooks/1/token",
      ALERT_DELIVERY_BACKOFF_MS: "0",
    },
    async () => {
      const alert = makeAlert();
      let calls = 0;

      installScriptedTransport(async () => {
        calls += 1;
        return { status: 429, headers: {}, bodyText: "rate limited" };
      });
      const rateLimited = await deliverAlertToChannel("discord", samplePayload(), alert, {
        idempotencyKey: "idem_429",
        withRetry: true,
      });
      assert(rateLimited.status === "failed", "429 must eventually fail after bounded retries.");
      assert(rateLimited.terminal === true, "Exhausted 429 retries must be terminal.");
      assert(calls === 3, "429 must retry up to max attempts.");

      calls = 0;
      installScriptedTransport(async () => {
        calls += 1;
        return { status: 503, headers: {}, bodyText: "unavailable" };
      });
      const serverError = await deliverAlertToChannel("discord", samplePayload(), alert, {
        idempotencyKey: "idem_503",
        withRetry: true,
      });
      assert(serverError.status === "failed" && calls === 3, "5xx must retry up to max attempts.");

      calls = 0;
      installScriptedTransport(async () => {
        calls += 1;
        return { status: 400, headers: {}, bodyText: "bad request" };
      });
      const permanent = await deliverAlertToChannel("discord", samplePayload(), alert, {
        idempotencyKey: "idem_400",
        withRetry: true,
      });
      assert(permanent.status === "failed" && permanent.terminal === true, "Permanent 4xx must be terminal.");
      assert(calls === 1, "Permanent 4xx must never retry.");
    },
  );
}

async function testTimeoutAndCancellation() {
  await withEnv(
    {
      ALERT_EMAIL_WEBHOOK_URL: "https://hooks.example.test/email",
      ALERT_EMAIL_WEBHOOK_SECRET: "fixture-secret",
      ALERT_DELIVERY_BACKOFF_MS: "0",
    },
    async () => {
      const alert = makeAlert();

      installScriptedTransport(async () => {
        throw new HttpTransportError("timeout", "Delivery request timed out.", {
          retryable: true,
          terminal: false,
        });
      });
      const timedOut = await deliverAlertToChannel("email", samplePayload(), alert, {
        idempotencyKey: "idem_timeout",
        withRetry: true,
      });
      assert(timedOut.status === "failed" && timedOut.attemptCount === 3, "Timeouts must retry then fail.");

      const controller = new AbortController();
      controller.abort();
      installScriptedTransport(async () => jsonResponse(200, { ok: true, id: "should_not_send" }));
      const cancelled = await deliverAlertToChannel("email", samplePayload(), alert, {
        idempotencyKey: "idem_cancel",
        signal: controller.signal,
        withRetry: true,
      });
      assert(cancelled.status === "failed" && cancelled.terminal, "Cancellation must be terminal failed.");
    },
  );
}

async function testDuplicateIdempotency() {
  await withEnv(
    {
      ALERT_DISCORD_WEBHOOK_URL: "https://discord.example.test/api/webhooks/1/token",
      ALERT_DELIVERY_BACKOFF_MS: "0",
    },
    async () => {
      let calls = 0;
      installScriptedTransport(async () => {
        calls += 1;
        return jsonResponse(200, { id: "discord_1" });
      });

      const alert = makeAlert();
      const observation = createAlertObservation({
        walletAddress: WALLET,
        triggerType: "critical_risk",
        observationKey: "onchain:fixture",
        value: 90,
        direction: "high_is_bad",
        evidence: {
          runId: "run_dup",
          agent: "onchain",
          label: "dup",
          detail: "dup",
          sourceLabels: ["GoPlus"],
        },
      });

      const first = await fanOutDeliveries(alert, observation, "trigger");
      const second = await fanOutDeliveries(alert, observation, "trigger");
      const discordFirst = first.find((row) => row.channel === "discord");
      const discordSecond = second.find((row) => row.channel === "discord");

      assert(discordFirst?.status === "delivered", "First discord fan-out must deliver.");
      assert(discordSecond?.id === discordFirst?.id, "Duplicate fan-out must reuse the same delivery row.");
      assert(calls === 1, "Duplicate idempotency key must not call the provider twice.");

      const key = buildDeliveryIdempotencyKey(alert.id, "discord", "trigger");
      assert(findDeliveryByIdempotencyKey(alert.id, WALLET, key)?.id === discordFirst?.id, "Idempotency lookup must find the row.");
    },
  );
}

async function testRetryPathAndRedaction() {
  await withEnv(
    {
      ALERT_DISCORD_WEBHOOK_URL: "https://discord.example.test/api/webhooks/1/token",
      ALERT_DELIVERY_BACKOFF_MS: "0",
    },
    async () => {
      const alert = makeAlert();
      const payload = samplePayload();
      const created = createAlertDelivery({
        alertId: alert.id,
        walletAddress: WALLET,
        channel: "discord",
        status: "failed",
        sanitizedPayload: payload,
        attemptCount: 1,
        idempotencyKey: "idem_retry_row",
        terminal: false,
        errorDetail: sanitizeDeliveryErrorDetail("failed talking to https://secret.example/hook and chat_id=999"),
      });

      assert(
        !created.errorDetail?.includes("https://") && !created.errorDetail?.includes("chat_id=999"),
        "Stored errorDetail must redact URLs and chat ids.",
      );

      installScriptedTransport(async () => jsonResponse(200, { id: "discord_retry" }));
      const retried = await retryAlertDelivery(created.id, WALLET);
      assert(retried.ok, "Non-terminal failed delivery must be retryable.");
      if (retried.ok) {
        assert(retried.delivery.status === "delivered", "Retry success must mark delivered.");
        assert(retried.delivery.providerMessageId === "discord_retry", "Retry must persist provider message id.");
      }

      const terminal = createAlertDelivery({
        alertId: alert.id,
        walletAddress: WALLET,
        channel: "discord",
        status: "failed",
        sanitizedPayload: payload,
        attemptCount: 1,
        idempotencyKey: "idem_terminal_row",
        terminal: true,
        errorDetail: "Provider rejected the delivery (400).",
      });
      const blocked = await retryAlertDelivery(terminal.id, WALLET);
      assert(!blocked.ok && blocked.status === 409, "Terminal failures must not be retried.");
    },
  );
}

async function testForceFailAndInApp() {
  await withEnv(
    {
      ALERT_FORCE_FAIL_CHANNELS: "email",
      ALERT_EMAIL_WEBHOOK_URL: "https://hooks.example.test/email",
      ALERT_EMAIL_WEBHOOK_SECRET: "fixture-secret",
    },
    async () => {
      const alert = makeAlert();
      const forced = await deliverAlertToChannel("email", samplePayload(), alert);
      assert(forced.status === "failed" && forced.errorDetail?.includes("ALERT_FORCE_FAIL_CHANNELS"), "Force-fail hook must remain intact.");

      const inApp = await deliverAlertToChannel("in_app", samplePayload(), alert);
      assert(inApp.status === "delivered", "in_app must always deliver.");
    },
  );
}

async function testSkippedWithoutConfig() {
  await withEnv(
    {
      ALERT_EMAIL_WEBHOOK_URL: undefined,
      ALERT_EMAIL_WEBHOOK_SECRET: undefined,
      ALERT_TELEGRAM_BOT_TOKEN: undefined,
      ALERT_TELEGRAM_CHAT_ID: undefined,
      ALERT_DISCORD_WEBHOOK_URL: undefined,
      ALERT_FORCE_FAIL_CHANNELS: undefined,
    },
    async () => {
      const alert = makeAlert();
      const email = await deliverAlertToChannel("email", samplePayload(), alert, { withRetry: false });
      const telegram = await deliverAlertToChannel("telegram", samplePayload(), alert, { withRetry: false });
      const discord = await deliverAlertToChannel("discord", samplePayload(), alert, { withRetry: false });
      assert(email.status === "skipped", "Email without env must skip.");
      assert(telegram.status === "skipped", "Telegram without env must skip.");
      assert(discord.status === "skipped", "Discord without env must skip.");
    },
  );
}

async function testPersistAndSanitizePayload() {
  const alert = makeAlert();
  const sanitized = buildSanitizedAlertPayload(alert, alert.evidenceAfter, { walletAddressHint: WALLET });
  assert(!JSON.stringify(sanitized).includes(WALLET.toLowerCase()), "Sanitized payload must not include full wallet.");
  const result = await deliverAlertToChannel("in_app", sanitized, alert);
  const row = persistDeliveryResult(alert, "in_app", sanitized, result, "idem_persist_in_app");
  assert(row.status === "delivered", "Persisted in_app row must be delivered.");
  assert(listAlertDeliveries(alert.id, WALLET).some((entry) => entry.id === row.id), "Persisted row must be listable.");
  updateAlertDelivery(row.id, WALLET, { attemptCount: row.attemptCount });
}

async function main() {
  process.env.ALERT_DELIVERY_BACKOFF_MS = "0";

  const tests = [
    ["email HMAC + success", testEmailHmacAndSuccess],
    ["telegram validation", testTelegramValidation],
    ["discord validation", testDiscordValidation],
    ["retryable/terminal failures", testRetryableAndTerminalFailures],
    ["timeout + cancellation", testTimeoutAndCancellation],
    ["duplicate idempotency", testDuplicateIdempotency],
    ["retry path + redaction", testRetryPathAndRedaction],
    ["force-fail + in_app", testForceFailAndInApp],
    ["skipped without config", testSkippedWithoutConfig],
    ["persist + sanitize", testPersistAndSanitizePayload],
  ] as const;

  for (const [name, run] of tests) {
    await run();
    console.log(`ok - ${name}`);
  }

  console.log(`alert-delivery-check: ${tests.length} fixtures passed`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
