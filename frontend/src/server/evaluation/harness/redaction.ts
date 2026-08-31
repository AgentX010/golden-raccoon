const REDACTED = "[REDACTED]";
const sensitiveKey = /(wallet|private|secret|mnemonic|seed|credential|authorization|cookie|session.?token|access.?token|api.?key|password|signature)/i;

/** Remove credentials while preserving chain, network, asset and scoring fields. */
export function redactValue(value: unknown, key?: string): unknown {
  if (key && sensitiveKey.test(key)) return REDACTED;
  if (Array.isArray(value)) return value.map((item) => redactValue(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([childKey, child]) => [
        childKey,
        redactValue(child, childKey),
      ]),
    );
  }
  return value;
}

export function redactTranscript<T extends Record<string, unknown>>(transcript: T): T {
  return redactValue(transcript) as T;
}

export function containsSensitiveValue(value: unknown): boolean {
  if (typeof value === "string") return value === REDACTED;
  if (Array.isArray(value)) return value.some(containsSensitiveValue);
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).some(containsSensitiveValue);
  }
  return false;
}
