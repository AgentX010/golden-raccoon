import "server-only";
import type { Alert, AlertDelivery } from "@/server/types";
import {
  HttpTransportError,
  sendAlertHttpRequest,
  throwForHttpStatus,
} from "@/server/observability/delivery/http";

export type TelegramDeliverySuccess = {
  providerMessageId: string;
};

function formatTelegramText(payload: AlertDelivery["sanitizedPayload"]): string {
  const lines = [
    `Alert · ${payload.severity.toUpperCase()}`,
    payload.summary,
    `Trigger: ${payload.triggerType}`,
    `Observation: ${payload.observationKey}`,
    `Before → after: ${payload.beforeValue} → ${payload.afterValue}`,
  ];

  if (payload.walletHint) lines.push(`Wallet: ${payload.walletHint}`);
  if (payload.sourceLabels?.length) lines.push(`Sources: ${payload.sourceLabels.join(", ")}`);
  if (payload.evidenceLinks.length) lines.push(`Evidence: ${payload.evidenceLinks.join(", ")}`);

  return lines.join("\n");
}

function parseTelegramMessageId(bodyText: string): string | undefined {
  try {
    const parsed = JSON.parse(bodyText) as {
      ok?: unknown;
      result?: { message_id?: unknown };
      description?: unknown;
    };

    if (parsed.ok !== true) return undefined;
    const messageId = parsed.result?.message_id;
    if (typeof messageId === "number" && Number.isFinite(messageId)) return String(messageId);
    if (typeof messageId === "string" && messageId.trim()) return messageId.trim();
  } catch {
    return undefined;
  }

  return undefined;
}

/**
 * Deliver via Telegram Bot API `sendMessage`.
 * Claims delivered only when the body has `ok: true` and a `message_id`.
 */
export async function deliverTelegramAlert(
  payload: AlertDelivery["sanitizedPayload"],
  _alert: Pick<Alert, "walletAddress" | "triggerType" | "severity">,
  options: { signal?: AbortSignal } = {},
): Promise<TelegramDeliverySuccess | { skipped: true; reason: string }> {
  const token = process.env.ALERT_TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.ALERT_TELEGRAM_CHAT_ID?.trim();

  if (!token || !chatId) {
    return {
      skipped: true,
      reason: "ALERT_TELEGRAM_BOT_TOKEN or ALERT_TELEGRAM_CHAT_ID is not configured",
    };
  }

  // Token is used only to build the request URL for the injectable transport.
  // Error paths never include the URL, token, or chat id.
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const body = JSON.stringify({
    chat_id: chatId,
    text: formatTelegramText(payload),
    disable_web_page_preview: true,
  });

  const response = await sendAlertHttpRequest({
    url,
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
    },
    body,
    signal: options.signal,
  });

  if (response.status < 200 || response.status >= 300) {
    throwForHttpStatus(response.status);
  }

  const providerMessageId = parseTelegramMessageId(response.bodyText);
  if (!providerMessageId) {
    throw new HttpTransportError(
      "malformed",
      "Telegram response was missing ok:true with message_id.",
      { retryable: false, terminal: true, status: response.status },
    );
  }

  return { providerMessageId };
}
