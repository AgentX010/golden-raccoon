import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const isCI = !!process.env.CI;

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: 1,
  reporter: [
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ["list"],
  ],
  use: {
    baseURL,
    trace: isCI ? "retain-on-failure" : "on-first-retry",
    screenshot: "only-on-failure",
    video: isCI ? "retain-on-failure" : "on-first-retry",
  },
  projects: [
    {
      name: "setup",
      testMatch: /specs\/_seed\.setup\.spec\.ts/,
    },
    {
      name: "chromium-desktop",
      dependencies: ["setup"],
      testMatch: /specs\/.*\.spec\.ts/,
      testIgnore: /specs\/_seed\.setup\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 832 },
      },
    },
    {
      name: "chromium-mobile",
      dependencies: ["setup"],
      testMatch: /specs\/.*\.spec\.ts/,
      testIgnore: /specs\/_seed\.setup\.spec\.ts/,
      use: {
        ...devices["Pixel 5"],
      },
    },
    {
      name: "legacy-desktop",
      testMatch: /^(?!specs\/).*\.spec\.ts$/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 832 },
      },
    },
  ],
  webServer: isCI
    ? {
        command: "npm run build && npm run start",
        port: 3000,
        timeout: 240_000,
        reuseExistingServer: false,
        env: {
          NODE_ENV: "test",
          APP_MODE: "test",
          NEXT_PUBLIC_APP_MODE: "test",
          NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: "gold-raccoon-demo",
          NEXT_PUBLIC_APP_URL: baseURL,
          NEXT_PUBLIC_STELLAR_NETWORK: "stellar-testnet",
        },
      }
    : {
        command: "npm run dev",
        port: 3000,
        timeout: 120_000,
        reuseExistingServer: false,
        env: {
          NODE_ENV: "test",
          APP_MODE: "test",
          NEXT_PUBLIC_APP_MODE: "test",
          NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: "gold-raccoon-demo",
          NEXT_PUBLIC_APP_URL: baseURL,
          NEXT_PUBLIC_STELLAR_NETWORK: "stellar-testnet",
        },
      },
});
