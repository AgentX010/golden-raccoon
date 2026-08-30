import { test, expect } from "../fixtures/test";
import { installMockEvmWallet, mockEvmWalletSession } from "../fixtures/mockEvmWallet";
import { installMockStellarWallet } from "../fixtures/mockStellarWallet";
import { EVM_WALLET, STELLAR_WALLET } from "../fixtures/tokens";

test.describe("Connect wallet journey", () => {
  test("loads landing page with branding", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Golden Raccoon" })).toBeVisible();
  });

  test("shows connect wallet button on dashboard", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.locator('button:has-text("Connect Wallet")').first()).toBeVisible();
  });

  test("opens wallet choice modal with EVM and Stellar options", async ({ page }) => {
    await page.goto("/dashboard");
    await page.locator('button:has-text("Connect Wallet")').first().click();

    await expect(page.locator("text=Select network")).toBeVisible();
    await expect(page.locator("text=EVM wallet")).toBeVisible();
    await expect(page.locator("text=Stellar wallet")).toBeVisible();
  });

  test("mock EVM wallet shows connected session on dashboard", async ({ page, mockPortfolioApi }) => {
    await mockPortfolioApi();
    await installMockEvmWallet(page);
    await mockEvmWalletSession(page);

    await page.goto("/dashboard");
    await expect(page.getByText(EVM_WALLET.slice(0, 6), { exact: false })).toBeVisible({ timeout: 15000 });
  });

  test("dashboard requires wallet to show portfolio when disconnected", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Connect your wallet" })).toBeVisible();
    await expect(page.locator("text=Wallet required")).toBeVisible();
  });
});

test.describe("Stellar wallet connect", () => {
  test("restored Stellar address appears in wallet selector", async ({ page }) => {
    await installMockStellarWallet(page);
    await page.goto("/dashboard");
    await page.locator('button:has-text("Connect Wallet")').first().click();
    await expect(page.getByText(STELLAR_WALLET.slice(0, 6), { exact: false })).toBeVisible();
  });
});
