export type ProviderAttempt = {
  url: string;
  ok: boolean;
  error?: string;
};

export type StellarFailoverPolicy<T> = {
  requestId?: string;
  expectedNetwork?: string;
  expectedPassphrase?: string;
  maxFreshnessMs?: number;
  inspect?: (value: T) => { network?: string; passphrase?: string; freshnessMs?: number };
};

export function redactProviderUrl(value: string) {
  try {
    const url = new URL(value);
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    return `${url.protocol}//${url.host}`;
  } catch {
    return "[invalid-provider-url]";
  }
}

export async function executeWithFallback<T>(
  urls: readonly string[],
  operation: (url: string, index: number, requestId?: string) => Promise<T>,
  policy: StellarFailoverPolicy<T> = {},
) {
  if (urls.length === 0) throw new Error("At least one provider URL is required.");
  const attempts: ProviderAttempt[] = [];

  for (const [index, url] of urls.entries()) {
    try {
      const value = await operation(url, index, policy.requestId);
      const identity = policy.inspect?.(value) ?? {};
      if (policy.expectedNetwork && identity.network !== policy.expectedNetwork) {
        throw new Error(`network_mismatch: expected ${policy.expectedNetwork}`);
      }
      if (policy.expectedPassphrase && identity.passphrase !== policy.expectedPassphrase) {
        throw new Error("network_mismatch: provider passphrase does not match requested network");
      }
      if (policy.maxFreshnessMs !== undefined && (identity.freshnessMs ?? Number.POSITIVE_INFINITY) > policy.maxFreshnessMs) {
        throw new Error(`provider_lag: response exceeds ${policy.maxFreshnessMs}ms freshness budget`);
      }
      attempts.push({ url: redactProviderUrl(url), ok: true });
      return { value, providerUrl: redactProviderUrl(url), providerIndex: index, fallbackUsed: index > 0, requestId: policy.requestId, attempts };
    } catch (cause) {
      attempts.push({ url: redactProviderUrl(url), ok: false, error: cause instanceof Error ? cause.message : "Unknown provider error" });
    }
  }

  throw new AggregateError(attempts.map((attempt) => new Error(`${attempt.url}: ${attempt.error}`)), "All Stellar providers failed.");
}
