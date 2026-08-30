export type E2eWalletOverride =
  | { family: "evm"; address: string; chainId: number; chainName?: string }
  | { family: "stellar"; address: string; network: "stellar-testnet" | "stellar-pubnet"; walletName?: string };

declare global {
  interface Window {
    __GR_E2E_WALLET__?: E2eWalletOverride;
  }
}

export function isE2eTestMode() {
  return process.env.NEXT_PUBLIC_APP_MODE === "test";
}

export function readE2eWalletOverride(): E2eWalletOverride | null {
  if (typeof window === "undefined") return null;

  const candidate = window.__GR_E2E_WALLET__;
  if (!candidate || typeof candidate !== "object") return null;

  if (candidate.family === "evm" && typeof candidate.address === "string" && typeof candidate.chainId === "number") {
    return candidate;
  }

  if (
    candidate.family === "stellar"
    && typeof candidate.address === "string"
    && (candidate.network === "stellar-testnet" || candidate.network === "stellar-pubnet")
  ) {
    return candidate;
  }

  return null;
}
