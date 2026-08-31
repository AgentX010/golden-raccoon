import type { APIRequestContext } from "@playwright/test";
export { E2E_SEED_EPOCH, EVM_WALLET, STELLAR_WALLET, evmTokens, stellarTokens } from "./fixtures/tokens";
export async function resetE2eStorage(request: APIRequestContext, baseURL: string) { const r = await request.post(`${baseURL}/api/dev/reset`); if (!r.ok()) throw new Error(`reset failed: ${r.status()}`); return r.json(); }
export async function seedE2eStorage(request: APIRequestContext, baseURL: string) { const r = await request.post(`${baseURL}/api/dev/seed`); if (!r.ok()) throw new Error(`seed failed: ${r.status()}`); return r.json(); }
export async function ensureE2eSeed(request: APIRequestContext, baseURL: string) { await resetE2eStorage(request, baseURL); return seedE2eStorage(request, baseURL); }
