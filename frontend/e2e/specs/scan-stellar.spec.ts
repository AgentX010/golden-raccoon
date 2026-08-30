import { test, expect } from "../fixtures/test";
import {
  mockStellarClassicAssetScanResult,
  mockStellarNativeScanResult,
  mockStellarTokenScanResult,
} from "../fixtures/mock-data";
import { stellarTokens } from "../fixtures/tokens";
import { installMockStellarWallet, mockStellarWalletSession } from "../fixtures/mockStellarWallet";

test.describe("Stellar scan journey", () => {
  async function runStellarScan(
    page: import("@playwright/test").Page,
    assetQuery: string,
    body: Record<string, unknown>,
  ) {
    await page.route("**/api/scan/token", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    });

    await page.goto("/scan");
    await page.locator("select").selectOption("stellar-testnet");
    await page.locator('input[placeholder*="DexScreener"]').fill(assetQuery);
    await page.locator('button:has-text("Run token agents")').first().click();
    await expect(page.locator("text=AI Risk Report")).toBeVisible({ timeout: 15000 });
  }

  test("scans Soroban-style Stellar asset and displays risk report", async ({ page }) => {
    await runStellarScan(page, stellarTokens.contract.address, mockStellarTokenScanResult());
    await expect(page.getByRole("heading", { name: "RST" })).toBeVisible();
  });

  test("scans native XLM separately from contract assets", async ({ page }) => {
    await runStellarScan(page, stellarTokens.nativeXlm.address, mockStellarNativeScanResult());
    await expect(page.getByRole("heading", { name: "XLM" })).toBeVisible();
  });

  test("scans classic CODE:ISSUER asset format", async ({ page }) => {
    await runStellarScan(page, stellarTokens.classicUsdc.address, mockStellarClassicAssetScanResult());
    await expect(page.getByRole("heading", { name: "USDC" })).toBeVisible();
  });

  test("shows Connect Stellar wallet when publish requires signer", async ({ page }) => {
    await runStellarScan(page, stellarTokens.contract.address, mockStellarTokenScanResult());
    await expect(page.locator('button:has-text("Connect Stellar wallet")')).toBeVisible();
  });

  test("restored Stellar wallet shows address in wallet selector", async ({ page }) => {
    await installMockStellarWallet(page);
    await mockStellarWalletSession(page);
    await runStellarScan(page, stellarTokens.contract.address, mockStellarTokenScanResult());
    await page.getByRole("button", { name: /GDXHOK/i }).click();
    await expect(page.getByText("Wallet session")).toBeVisible();
    await expect(page.getByText("Display only — reconnect")).toBeVisible();
  });
});
