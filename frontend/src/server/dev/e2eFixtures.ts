import { E2E_SEED_EPOCH, EVM_WALLET } from "@/lib/e2e/tokens";
export const E2E_FIXTURE_CREATED_AT = E2E_SEED_EPOCH;
export const e2eSeedBundle = {
  recommendations: [
    { walletAddress: EVM_WALLET, action: "monitor" as const, decisionScore: 67, confidence: 0.72, summary: "E2E seeded recommendation — monitor MEME exposure." },
    { walletAddress: EVM_WALLET, action: "watch" as const, decisionScore: 55, confidence: 0.66, summary: "E2E seeded recommendation — watch MEME exposure." },
  ],
  approvals: [{ walletAddress: EVM_WALLET, txHash: "0xe2e0000000000000000000000000000000000000000000000000000000000001" as const, network: "base", action: "monitor" as const, asset: "MEME", valueUsd: 31250 }], // deploy-readiness-allow-secret
  transactions: [
    { hash: "0xe2e0000000000000000000000000000000000000000000000000000000000002" as const, type: "approval" as const, status: "confirmed" as const, lifecycleStatus: "confirmed" as const, network: "base", walletAddress: EVM_WALLET, chainFamily: "evm" as const, asset: "MEME", valueUsd: 31250 }, // deploy-readiness-allow-secret
    { hash: "0xe2e0000000000000000000000000000000000000000000000000000000000003" as const, type: "swap" as const, status: "confirmed" as const, lifecycleStatus: "confirmed" as const, network: "base", walletAddress: EVM_WALLET, chainFamily: "evm" as const, asset: "USDC", valueUsd: 500 }, // deploy-readiness-allow-secret
  ],
};
