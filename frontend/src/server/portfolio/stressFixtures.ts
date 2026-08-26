import type { PortfolioSnapshot } from "../types";
import { getMockPortfolio } from "./mockPortfolio";

export const mockPortfolioFixture: PortfolioSnapshot = getMockPortfolio("0xStressTestWallet");

// You can add more fixtures with different balances/tokens if needed.
export const allTokensFixture: PortfolioSnapshot = {
  ...mockPortfolioFixture,
  walletAddress: "0xAllTokens",
  holdings: [
    ...mockPortfolioFixture.holdings,
    {
      tokenAddress: "stellar:native",
      symbol: "XLM",
      name: "Stellar Lumens",
      assetKind: "native",
      isVerified: true,
      balance: 1000,
      priceUsd: 0.1,
      valueUsd: 100,
      allocationPercent: 10,
      riskScore: 10,
      riskLevel: "low",
      signals: {
        scamRisk: 1,
        websiteTrustRisk: 1,
        contractRisk: 1,
        whaleSellRisk: 5,
        liquidityRisk: 5,
        xSentimentRisk: 5,
        holderConcentrationRisk: 5,
        priceVolatilityRisk: 20,
        portfolioExposureRisk: 10,
      },
    }
  ]
};
