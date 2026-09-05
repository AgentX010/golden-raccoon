export const capabilities = [
  "portfolio:read",
  "watchlist:write",
  "rules:write",
  "execution:prepare",
  "execution:submit",
  "auto-mode:authorize",
  "operations:read",
] as const;

export type Capability = (typeof capabilities)[number];

export const capabilityIsMutating = (capability: Capability) => capability.endsWith(":write") || capability.endsWith(":prepare") || capability.endsWith(":submit") || capability === "auto-mode:authorize";

export function isCapability(value: string): value is Capability {
  return (capabilities as readonly string[]).includes(value);
}
