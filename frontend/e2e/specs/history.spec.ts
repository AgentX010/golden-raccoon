import { test, expect } from "@playwright/test";
import { ensureE2eSeed } from "../seed";

test.describe("History journey", () => {
  test.beforeEach(async ({ request, baseURL }) => {
    test.skip(!baseURL, "baseURL is required");
    await ensureE2eSeed(request, baseURL!);
  });

  test("shows seeded recommendation and transaction counts", async ({ page }) => {
    await page.goto("/history");

    await expect(page.locator("h1:has-text('History')")).toBeVisible();
    await expect(page.locator("text=2 recommendations")).toBeVisible();
    await expect(page.locator("text=1 approvals")).toBeVisible();
    await expect(page.locator("text=3 transactions")).toBeVisible();
  });

  test("recent activity accordion lists recommendations, approvals, and transactions", async ({ page }) => {
    await page.goto("/history");
    await page.locator("summary:has-text('Recent activity')").click();

    const activitySection = page.locator("details").filter({ hasText: "Recent activity" });
    await expect(activitySection.getByText("Recommendations", { exact: true })).toBeVisible();
    await expect(activitySection.getByText("Approvals", { exact: true })).toBeVisible();
    await expect(activitySection.getByText("Transactions", { exact: true })).toBeVisible();
    await expect(page.locator("text=No recommendation records yet.")).not.toBeVisible();
  });

  test("seeded EVM transaction appears in history table", async ({ page }) => {
    await page.goto("/history");
    await page.locator("summary:has-text('Recent activity')").click();
    await expect(page.locator("text=0xe2e0000000000000000000000000000000000000000000000000000000000002")).toBeVisible();
  });
});
