import type { AuthzSubject } from "./subject";

export type AuthzResource = {
  walletAddress?: string;
  chainFamily?: "evm" | "stellar";
  network?: string;
  id?: string;
  serverSigning?: boolean;
};

export function ownsResource(subject: AuthzSubject, resource: AuthzResource) {
  if (!resource.walletAddress) return true;
  return subject.kind === "wallet" && subject.walletAddress?.trim().toLowerCase() === resource.walletAddress.trim().toLowerCase();
}

export function matchesScope(subject: AuthzSubject, resource: AuthzResource) {
  const networkMatches = !resource.network || !subject.network || subject.network === resource.network.trim().toLowerCase();
  const familyMatches = !resource.chainFamily || !subject.chainFamily || subject.chainFamily === resource.chainFamily;
  return networkMatches && familyMatches;
}
