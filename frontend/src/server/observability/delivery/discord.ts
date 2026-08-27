import "server-only";
import type { Alert, AlertDelivery } from "@/server/types";
import {
  HttpTransportError,
  sendAlertHttpRequest,
  throwForHttpStatus,
} from "@/server/observability/delivery/http";

export type DiscordDeliverySuccess = {
  providerMessageId?: string;
};

function withWaitQuery(webhookUrl: string): string {
  try {
    const url = new URL(webhookUrl);
    if (!url.searchParams.has("wait")) {
      url.searchParams.set("wait", "true");
    }
    return url.toString();
  } catch {
    // Fall back to a simple append when the configured value is not a full URL
    // (tests inject fake transports and never resolve DNS).
    return webhookUrl.includes("?")
      ? `${webhookUrl}&wait=true`
      : `${webhookUrl}?wait=true`;
  }
}

function formatDiscordContent(payload: AlertDelivery["sanitizedPayload"]): string {
  const lines = [
    `**Alert · ${payload.severity.toUpperCase()}**`,
    payload.summary,
    `Trigger: \`${payload.triggerType}\``,
    `Observation: \`${payload.observationKey}\``,
    `Before → after: ${payload.beforeValue} → ${payload.afterValue}`,
  ];

  if (payload.walletHint) lines.push(`Wallet: ${payload.walletHint}`);
  if (payload.sourceLabels?.length) lines.push(`Sources: ${payload.sourceLabels.join(", ")}`);
  if (payload.evidenceLinks.length) lines.push(`Evidence: ${payload.evidenceLinks.join(", ")}`);

  return lines.join("\n").slice(0, 1900);
}

function parseDiscordMessageId(bodyText: string): string | undefined {
  if (!bodyText.trim()) return undefined;

  try {
    const parsed = JSON.parse(bodyText) as { id?: unknown };
    if (typeof parsed.id === "string" && parsed.id.trim()) return parsed.id.trim();
    if (typeof parsed.id === "number" && Number.isFinite(parsed.id)) return String(parsed.id);
  } catch {
    return undefined;
  }

  return undefined;
}

/**
 * Deliver via Discord incoming webhook.
 * Claims delivered only on HTTP 204, or HTTP 200 with a usable message `id`.
 */
export async function deliverDiscordAlert(
  payload: AlertDelivery["sanitizedPayload"],
  _alert: Pick<Alert, "walletAddress" | "triggerType" | "severity">,
  options: { signal?: AbortSignal } = {},
): Promise<DiscordDeliverySuccess | { skipped: true; reason: string }> {
  const webhookUrl = process.env.ALERT_DISCORD_WEBHOOK_URL?.trim();

  if (!webhookUrl) {
    return {
      skipped: true,
      reason: "ALERT_DISCORD_WEBHOOK_URL is not configured",
    };
  }

  const response = await sendAlertHttpRequest({
    url: withWaitQuery(webhookUrl),
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      content: formatDiscordContent(payload),
      allowed_mentions: { parse: [] },
    }),
    signal: options.signal,
  });

  if (response.status === 204) {
    return {};
  }

  if (response.status < 200 || response.status >= 300) {
    throwForHttpStatus(response.status);
  }

  // 200 with wait=true must include a message id; otherwise treat as malformed.
  if (response.status === 200) {
    const providerMessageId = parseDiscordMessageId(response.bodyText);
    if (!providerMessageId) {
      throw new HttpTransportError(
        "malformed",
        "Discord webhook returned 200 without a usable message id.",
        { retryable: false, terminal: true, status: response.status },
      );
    }
    return { providerMessageId };
  }

  // Other 2xx without a clear contract are treated as terminal malformed.
  throw new HttpTransportError(
    "malformed",
    `Discord webhook returned unsupported success status (${response.status}).`,
    { retryable: false, terminal: true, status: response.status },
  );
}
