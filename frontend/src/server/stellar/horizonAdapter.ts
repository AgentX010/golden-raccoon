import { randomUUID } from "node:crypto";
import { Horizon } from "@stellar/stellar-sdk";
import {
  getStellarDataApiUrls,
  getStellarNetwork,
  type StellarNetworkId,
} from "@/lib/stellar/config";
import {
  StellarDataLayerError,
  type StellarProviderAttempt,
  type StellarProviderMetadata,
} from "@/server/stellar/dataLayer";
import { redactProviderUrl } from "@/lib/stellar/failover";
import { sharedProviderCircuits } from "@/server/providers/adapter";

export type StellarAccountRecord = Awaited<
  ReturnType<Horizon.Server["loadAccount"]>
>;

export type StellarAccountDataAdapter = {
  loadAccount(
    accountId: string,
    network: StellarNetworkId,
    requestId?: string,
  ): Promise<{ value: StellarAccountRecord; meta: StellarProviderMetadata }>;
};

type HorizonAdapterOptions = {
  providerUrls?: Partial<Record<StellarNetworkId, readonly string[]>>;
  serverFactory?: (url: string, requestId: string) => Pick<Horizon.Server, "loadAccount">;
  timeoutMs?: number;
  retryLimit?: number;
  now?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
};

function defaultServerFactory(url: string, requestId: string) {
  return new Horizon.Server(url, {
    allowHttp: url.startsWith("http://"),
    headers: { "x-request-id": requestId },
  });
}

function classify(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();
  const timeout = normalized.includes("timeout") || normalized.includes("abort");
  return {
    message,
    code: timeout ? ("timeout" as const) : ("transport_error" as const),
    retryable:
      timeout ||
      normalized.includes("fetch") ||
      normalized.includes("network") ||
      normalized.includes("econn"),
  };
}

async function timeout<T>(operation: Promise<T>, milliseconds: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () =>
        reject(
          new StellarDataLayerError(
            "timeout",
            `Horizon request timed out after ${milliseconds}ms`,
            true,
          ),
        ),
      milliseconds,
    );
  });
  try {
    return await Promise.race([operation, deadline]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export class HorizonAccountDataAdapter implements StellarAccountDataAdapter {
  private readonly options: Required<
    Pick<HorizonAdapterOptions, "timeoutMs" | "retryLimit" | "now" | "sleep">
  > &
    HorizonAdapterOptions;

  constructor(options: HorizonAdapterOptions = {}) {
    this.options = {
      ...options,
      timeoutMs: options.timeoutMs ?? 8_000,
      retryLimit: Math.max(0, options.retryLimit ?? 1),
      now: options.now ?? Date.now,
      sleep:
        options.sleep ??
        ((milliseconds) =>
          new Promise((resolve) => {
            setTimeout(resolve, milliseconds);
          })),
    };
  }

  async loadAccount(
    accountId: string,
    networkId: StellarNetworkId,
    requestId: string = randomUUID(),
  ) {
    const network = getStellarNetwork(networkId);
    if (!network) {
      throw new StellarDataLayerError(
        "invalid_request",
        `Unsupported Stellar network: ${networkId}`,
        false,
      );
    }
    const urls =
      this.options.providerUrls?.[networkId] ?? getStellarDataApiUrls(network);
    const attempts: StellarProviderAttempt[] = [];
    const startedAt = this.options.now();

    for (const [providerIndex, providerUrl] of urls.entries()) {
      const safeProviderUrl = redactProviderUrl(providerUrl);
      const circuitKey = `stellar-horizon:${networkId}:${safeProviderUrl}`;
      for (let attempt = 0; attempt <= this.options.retryLimit; attempt += 1) {
        const attemptStartedAt = this.options.now();
        try {
          sharedProviderCircuits.acquire(circuitKey);
          const server = (this.options.serverFactory ?? defaultServerFactory)(
            providerUrl,
            requestId,
          );
          const account = await timeout(
            server.loadAccount(accountId),
            this.options.timeoutMs,
          );
          const ledgerHeight =
            "last_modified_ledger" in account &&
            typeof account.last_modified_ledger === "number"
              ? account.last_modified_ledger
              : undefined;
          sharedProviderCircuits.success(circuitKey, this.options.now() - attemptStartedAt);
          attempts.push({
            providerUrl: safeProviderUrl,
            stage: "operation",
            attempt: attempt + 1,
            ok: true,
            latencyMs: this.options.now() - attemptStartedAt,
            ledgerHeight,
          });
          const failures = attempts.filter((item) => !item.ok).length;
          const fallbackUsed = providerIndex > 0;
          const reliability = Math.max(
            0,
            0.96 - failures * 0.16 - (fallbackUsed ? 0.1 : 0),
          );

          return {
            value: account,
            meta: {
              requestId,
              network: networkId,
              providerUrl: safeProviderUrl,
              fallbackUsed,
              checkedAt: new Date(startedAt).toISOString(),
              freshnessMs: 0,
              latencyMs: this.options.now() - startedAt,
              ledgerHeight,
              highestObservedLedger: ledgerHeight,
              ledgerLag: 0,
              providerDisagreement: failures > 0,
              attempts,
              reliability,
              confidence: Math.max(0, reliability - (failures > 0 ? 0.1 : 0)),
            },
          };
        } catch (error) {
          const failure = classify(error);
          sharedProviderCircuits.failure(circuitKey, this.options.now() - attemptStartedAt, failure.retryable);
          attempts.push({
            providerUrl: safeProviderUrl,
            stage: "operation",
            attempt: attempt + 1,
            ok: false,
            latencyMs: this.options.now() - attemptStartedAt,
            errorCode: failure.code,
            error: failure.message.replaceAll(providerUrl, safeProviderUrl),
          });
          if (!failure.retryable || attempt === this.options.retryLimit) break;
          await this.options.sleep(Math.round(100 * 2 ** attempt * (0.75 + Math.random() * 0.5)));
        }
      }
    }

    const retryable = attempts
      .filter((attempt) => !attempt.ok)
      .every(
        (attempt) =>
          attempt.errorCode === "timeout" ||
          attempt.errorCode === "transport_error",
      );
    throw new StellarDataLayerError(
      "all_providers_failed",
      `All Stellar data API providers failed for ${networkId}.`,
      retryable,
      attempts,
    );
  }
}
