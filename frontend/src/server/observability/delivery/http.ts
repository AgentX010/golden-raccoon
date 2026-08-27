import "server-only";

export type HttpRequest = {
  url: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
};

export type HttpResponse = {
  status: number;
  headers: Record<string, string>;
  bodyText: string;
};

export type AlertHttpTransport = (request: HttpRequest) => Promise<HttpResponse>;

export class HttpTransportError extends Error {
  readonly kind: string;
  readonly retryable: boolean;
  readonly terminal: boolean;
  readonly status?: number;

  constructor(
    kind: string,
    message: string,
    options: { retryable: boolean; terminal: boolean; status?: number },
  ) {
    super(message);
    this.name = "HttpTransportError";
    this.kind = kind;
    this.retryable = options.retryable;
    this.terminal = options.terminal;
    this.status = options.status;
  }
}

const DEFAULT_TIMEOUT_MS = 10_000;

let injectedTransport: AlertHttpTransport | undefined;

export function setAlertDeliveryTransport(transport: AlertHttpTransport): void {
  injectedTransport = transport;
}

export function resetAlertDeliveryTransport(): void {
  injectedTransport = undefined;
}

export function getAlertDeliveryTransport(): AlertHttpTransport {
  return injectedTransport ?? defaultAlertDeliveryTransport;
}

/**
 * Classify provider HTTP status codes for retry policy:
 * - 429 and 5xx are retryable
 * - other 4xx are terminal
 * - 2xx are success (caller still validates body shape)
 */
export function classifyHttpStatus(status: number): {
  ok: boolean;
  retryable: boolean;
  terminal: boolean;
} {
  if (status >= 200 && status < 300) {
    return { ok: true, retryable: false, terminal: false };
  }
  if (status === 429 || status >= 500) {
    return { ok: false, retryable: true, terminal: false };
  }
  if (status >= 400) {
    return { ok: false, retryable: false, terminal: true };
  }
  return { ok: false, retryable: true, terminal: false };
}

export function throwForHttpStatus(status: number, detail?: string): never {
  const classified = classifyHttpStatus(status);
  if (classified.ok) {
    throw new HttpTransportError("http", detail ?? `Unexpected success handler for status ${status}.`, {
      retryable: false,
      terminal: true,
      status,
    });
  }

  throw new HttpTransportError(
    "http",
    detail ?? (classified.terminal
      ? `Provider rejected the delivery (${status}).`
      : `Provider returned a transient error (${status}).`),
    {
      retryable: classified.retryable,
      terminal: classified.terminal,
      status,
    },
  );
}

async function defaultAlertDeliveryTransport(request: HttpRequest): Promise<HttpResponse> {
  const timeoutMs = request.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const onExternalAbort = () => controller.abort();
  if (request.signal) {
    if (request.signal.aborted) {
      clearTimeout(timer);
      throw new HttpTransportError("cancelled", "Delivery request was cancelled.", {
        retryable: false,
        terminal: true,
      });
    }
    request.signal.addEventListener("abort", onExternalAbort, { once: true });
  }

  try {
    const response = await fetch(request.url, {
      method: request.method ?? "POST",
      headers: request.headers,
      body: request.body,
      signal: controller.signal,
      cache: "no-store",
    });

    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    return {
      status: response.status,
      headers,
      bodyText: await response.text(),
    };
  } catch (error) {
    if (request.signal?.aborted) {
      throw new HttpTransportError("cancelled", "Delivery request was cancelled.", {
        retryable: false,
        terminal: true,
      });
    }
    if (controller.signal.aborted) {
      throw new HttpTransportError("timeout", "Delivery request timed out.", {
        retryable: true,
        terminal: false,
      });
    }
    const message = error instanceof Error ? error.message : "Delivery network request failed.";
    throw new HttpTransportError("network", message, {
      retryable: true,
      terminal: false,
    });
  } finally {
    clearTimeout(timer);
    request.signal?.removeEventListener("abort", onExternalAbort);
  }
}

export async function sendAlertHttpRequest(request: HttpRequest): Promise<HttpResponse> {
  return getAlertDeliveryTransport()(request);
}
