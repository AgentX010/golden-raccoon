import { createHash } from "node:crypto";
import { readWalletSessionCookie } from "@/server/security/walletSession";

export type AuthzSubject = {
  kind: "anonymous" | "wallet";
  walletAddress?: string;
  walletHash: string;
  chainFamily?: "evm" | "stellar";
  network?: string;
};

export function walletHash(walletAddress: string) {
  return createHash("sha256").update(walletAddress.trim().toLowerCase()).digest("hex").slice(0, 24);
}

export function createSubject(input: { walletAddress?: string; chainFamily?: "evm" | "stellar"; network?: string }): AuthzSubject {
  const walletAddress = input.walletAddress?.trim();
  return walletAddress
    ? { kind: "wallet", walletAddress, walletHash: walletHash(walletAddress), chainFamily: input.chainFamily, network: input.network?.trim().toLowerCase() }
    : { kind: "anonymous", walletHash: "anonymous", chainFamily: input.chainFamily, network: input.network?.trim().toLowerCase() };
}

export function subjectFromRequest(request: Request, scope: { chainFamily?: "evm" | "stellar"; network?: string } = {}) {
  return createSubject({ walletAddress: readWalletSessionCookie(request), ...scope });
}
