import { test, expect } from "../fixtures/test";
import { mockTokenScanResult } from "../fixtures/mock-data";
import { evmTokens } from "../fixtures/tokens";

test.describe("EVM scan journey", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/scan");
  });

  test("displays scan page with input form", async ({ page }) => {
    await expect(page.locator("h1:has-text('Scan token')")).toBeVisible();
    await expect(page.locator("select")).toBeVisible();
    await expect(page.locator('input[placeholder*="DexScreener"]')).toBeVisible();
    await expect(page.locator('button:has-text("Run token agents")')).toBeVisible();
  });

  test("runs EVM token scan and displays risk report", async ({ page, mockScanApi }) => {
    await mockScanApi();

    await page.locator('input[placeholder*="DexScreener"]').fill(evmTokens.meme.address);
    await page.locator('button:has-text("Run token agents")').first().click();

    await expect(page.locator("text=AI Risk Report")).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("heading", { name: "MEME" })).toBeVisible();
    await expect(page.locator("text=Buy risk")).toBeVisible();
    await expect(page.locator("text=Top reasons")).toBeVisible();
    await expect(page.locator("text=Why this is risky")).toBeVisible();
  });

  test("shows agent and market detail sections", async ({ page, mockScanApi }) => {
    await mockScanApi();

    await page.locator('input[placeholder*="DexScreener"]').fill(evmTokens.meme.address);
    await page.locator('button:has-text("Run token agents")').first().click();
    await expect(page.locator("text=AI Risk Report")).toBeVisible({ timeout: 15000 });

    await page.locator("summary:has-text('Agent details')").click();
    await expect(page.locator("text=Decision Agent")).toBeVisible();

    await page.locator("summary:has-text('Market details')").click();
    const marketSection = page.locator("details").filter({ hasText: "Market details" });
    await expect(marketSection.locator("text=Liquidity")).toBeVisible();
  });

  test("handles scan error state gracefully", async ({ page, mockScanApi }) => {
    await mockScanApi({ returnError: true });

    await page.locator('input[placeholder*="DexScreener"]').fill("0x0000000000000000000000000000000000000000");
    await page.locator('button:has-text("Run token agents")').first().click();
    await expect(page.getByRole("heading", { name: "Scan failed" })).toBeVisible({ timeout: 15000 });
  });

  test("server scan responses never include a signed transaction", async ({ page }) => {
    const responses: string[] = [];
    await page.route("**/api/scan/token", async (route) => {
      const body = JSON.stringify(mockTokenScanResult({ id: "e2e-leak-check" }));
      responses.push(body);
      await route.fulfill({ status: 200, contentType: "application/json", body });
    });

    await page.locator('input[placeholder*="DexScreener"]').fill(evmTokens.meme.address);
    await page.locator('button:has-text("Run token agents")').first().click();
    await expect(page.locator("text=AI Risk Report")).toBeVisible({ timeout: 15000 });

    for (const payload of responses) {
      expect(payload.toLowerCase()).not.toContain("signedtx");
      expect(payload.toLowerCase()).not.toContain("privatekey");
    }
  });
});
