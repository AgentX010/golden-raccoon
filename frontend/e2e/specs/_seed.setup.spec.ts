import { test, expect } from "@playwright/test";
import { ensureE2eSeed } from "../seed";

test.describe("E2E storage seed", () => {
  test("reset and seed deterministic fixtures", async ({ request, baseURL }) => {
    test.skip(!baseURL, "baseURL is required for seed setup");
    const result = await ensureE2eSeed(request, baseURL!);
    expect(result.seeded).toBe(true);
    expect(result.counts.recommendations).toBeGreaterThan(0);
    expect(result.counts.transactions).toBeGreaterThan(0);
  });
});
