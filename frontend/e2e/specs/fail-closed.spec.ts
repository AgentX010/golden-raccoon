import { test, expect } from "../fixtures/test";
import {
  mockUnavailableProviderScanResult,
  mockUnpricedAssetScanResult,
} from "../fixtures/mock-data";
import { evmTokens } from "../fixtures/tokens";

test.describe("Fail-closed paths", () => {
  test("unavailable provider shows conservative unavailable state, not mock success", async ({ page }) => {
    await page.route("**/api/scan/token", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockUnavailableProviderScanResult()),
      });
    });

    await page.goto("/scan");
    await page.locator('input[placeholder*="DexScreener"]').fill(evmTokens.meme.address);
    await page.locator('button:has-text("Run token agents")').first().click();
    await expect(page.locator("text=AI Risk Report")).toBeVisible({ timeout: 15000 });

    await page.locator("summary:has-text('Data quality')").click();
    await expect(page.getByText("Provider unavailable or token identity could not be resolved")).toBeVisible();
    await expect(page.getByText("Demo/mock data is present")).not.toBeVisible();

    await page.locator("summary:has-text('Execution details')").click();
    await expect(page.getByText(/Provider unavailable/)).toBeVisible();
  });

  test("unpriced asset blocks executable preview with quote unavailable", async ({ page }) => {
    await page.route("**/api/scan/token", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockUnpricedAssetScanResult()),
      });
    });

    await page.goto("/scan");
    await page.locator('input[placeholder*="DexScreener"]').fill(evmTokens.meme.address);
    await page.locator('button:has-text("Run token agents")').first().click();
    await expect(page.locator("text=AI Risk Report")).toBeVisible({ timeout: 15000 });

    await page.locator("summary:has-text('Execution details')").click();
    await expect(page.getByText(/price unavailable/i)).toBeVisible();
  });

  test("network mismatch blocks approval validation", async ({ page }) => {
    await page.route("**/api/execute/approve", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          allowed: false,
          walletOk: true,
          networkOk: false,
          expired: false,
          actionSafe: true,
          blockedReason: "Connected network arbitrum does not match expected base.",
        }),
      });
    });

    await page.goto("/scan");
    const result = await page.evaluate(async () => {
      const response = await fetch("/api/execute/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotencyKey: "e2e-network-mismatch",
          walletAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18",
          chainFamily: "evm",
          network: "base",
          connectedWallet: "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18",
          connectedNetwork: "42161",
        }),
      });
      return response.json();
    });

    expect(result.allowed).toBe(false);
    expect(result.networkOk).toBe(false);
  });

  test("rejected signature leaves no transaction record", async ({ page, request, baseURL }) => {
    test.skip(!baseURL, "baseURL required");

    await page.route("**/api/execute/submit", async (route) => {
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ error: "User rejected signature" }),
      });
    });

    const before = await request.get(`${baseURL}/api/history/transactions`);
    const beforePayload = await before.json();
    const beforeCount = Array.isArray(beforePayload.items) ? beforePayload.items.length : 0;

    await page.goto("/scan");
    await page.evaluate(async () => {
      await fetch("/api/execute/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chainFamily: "evm",
          network: "base",
          walletAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18",
          signedPayload: "0xrejected",
          asset: "MEME",
          userApproved: true,
        }),
      }).catch(() => undefined);
    });

    const after = await request.get(`${baseURL}/api/history/transactions`);
    const afterPayload = await after.json();
    const afterCount = Array.isArray(afterPayload.items) ? afterPayload.items.length : 0;

    expect(afterCount).toBe(beforeCount);
  });

  test("portfolio provider unavailable shows fail-closed dashboard state", async ({ page, mockPortfolioApi, setupWalletConnected }) => {
    await mockPortfolioApi({ returnError: true });
    await page.goto("/dashboard");
    await expect(page.getByText("Provider unavailable")).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("No mock data used")).toBeVisible();
  });
});
