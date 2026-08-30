import type { Page } from "@playwright/test";
import { EVM_WALLET } from "./tokens";
export async function installMockEvmWallet(page: Page, options: { address?: string; chainId?: number } = {}) {
  const address = options.address ?? EVM_WALLET; const chainId = options.chainId ?? 8453;
  await page.addInitScript(({ walletAddress, hexChainId }) => {
    Object.defineProperty(window, "ethereum", { configurable: true, value: { isMetaMask: true, chainId: hexChainId, request: async ({ method }: { method: string }) => {
      if (method === "eth_requestAccounts" || method === "eth_accounts") return [walletAddress];
      if (method === "eth_chainId") return hexChainId;
      if (method === "personal_sign" || method === "eth_signTypedData_v4") return "0xe2e_mock_signature";
      return null;
    }, on: () => undefined, removeListener: () => undefined } });
    window.localStorage.setItem("golden-raccoon:selected-wallet-family:v1", "evm");
  }, { walletAddress: address, hexChainId: `0x${chainId.toString(16)}` });
}
export async function mockEvmWalletSession(page: Page, address = EVM_WALLET) {
  await page.route("**/api/wallet-session/nonce", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ nonce: "e2e-evm", challenge: "e2e", family: "evm", walletAddress: address, issuedAt: "2024-01-01T00:00:00.000Z", expiresAt: "2024-01-01T01:00:00.000Z", network: null }) }));
  await page.route("**/api/wallet-session", async (route) => { const m = route.request().method(); if (m === "POST") await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) }); else if (m === "DELETE") await route.fulfill({ status: 200, contentType: "application/json", body: "{}" }); else await route.continue(); });
}
