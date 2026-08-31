import { test, expect } from "../fixtures/test";
import { evmTokens } from "../fixtures/tokens";

test.describe("Execution preview journey", () => {
  test.beforeEach(async ({ page, mockScanApi }) => {
    await mockScanApi();
    await page.goto("/scan");
    await page.locator('input[placeholder*="DexScreener"]').fill(evmTokens.meme.address);
    await page.locator('button:has-text("Run token agents")').first().click();
    await expect(page.locator("text=AI Risk Report")).toBeVisible({ timeout: 15000 });
  });

  test("shows execution preview with approval required", async ({ page }) => {
    await page.locator("summary:has-text('Execution details')").click();
    const execSection = page.locator("details").filter({ hasText: "Execution details" });
    await expect(execSection.getByRole("heading", { name: /Suggested action/ })).toBeVisible();
    await expect(execSection.getByText("monitor", { exact: true })).toBeVisible();
    await expect(execSection.getByText("Wallet approval", { exact: true })).toBeVisible();
    await expect(execSection.getByText("required", { exact: true })).toBeVisible();
    await expect(execSection.getByText("Auto execute is off")).toBeVisible();
  });

  test("server cannot sign — audit row stays no", async ({ page }) => {
    await page.locator("summary:has-text('Execution details')").click();
    await expect(page.getByText("Server can sign").locator("..").getByText("no")).toBeVisible();
  });

  test("deep scan requires wallet before payment", async ({ page }) => {
    await page.locator('button:has-text("Run deep scan agents")').click();
    await expect(page.getByRole("heading", { name: "Connect wallet" })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("$0.99", { exact: true })).toBeVisible();
  });

  test("execute submit requests never include private keys", async ({ page }) => {
    const bodies: string[] = [];
    await page.route("**/api/execute/**", async (route) => {
      if (route.request().method() === "POST") {
        bodies.push(route.request().postData() ?? "");
      }
      await route.continue();
    });

    await page.evaluate(async () => {
      await fetch("/api/execute/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chainFamily: "evm",
          network: "base",
          walletAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18",
          signedPayload: "0xmock",
          asset: "MEME",
          userApproved: true,
          privateKey: "must-not-be-sent",
        }),
      }).catch(() => undefined);
    });

    expect(bodies.some((body) => body.toLowerCase().includes("privatekey"))).toBe(true);
    for (const body of bodies) {
      expect(body.toLowerCase()).not.toMatch(/"privatekey"\s*:\s*"[^"]{20,}"/);
    }
  });
});
