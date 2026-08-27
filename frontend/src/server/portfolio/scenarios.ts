export type StressTarget = "all" | "stablecoins" | "memecoins" | "stellar_native" | string;

export type StressChange = {
  type: "price_multiplier" | "fixed_price" | "depeg";
  target: StressTarget;
  multiplier?: number;
  fixedUsd?: number;
};

export type PortfolioStressScenario = {
  id: string;
  name: string;
  description: string;
  version: number;
  changes: StressChange[];
};

export const STRESS_SCENARIOS: PortfolioStressScenario[] = [
  {
    id: "market_crash_20",
    name: "20% Market Crash",
    description: "Broad market decline of 20% across all assets except stablecoins.",
    version: 1,
    changes: [
      {
        type: "price_multiplier",
        target: "all",
        multiplier: 0.8,
      },
      {
        type: "fixed_price",
        target: "stablecoins",
        fixedUsd: 1.0,
      }
    ],
  },
  {
    id: "stablecoin_depeg",
    name: "Stablecoin Depeg (80c)",
    description: "Major stablecoins depeg and drop to $0.80.",
    version: 1,
    changes: [
      {
        type: "depeg",
        target: "stablecoins",
        fixedUsd: 0.8,
      },
    ],
  },
  {
    id: "memecoin_crash",
    name: "Memecoin Collapse",
    description: "Meme coins lose 90% of their value.",
    version: 1,
    changes: [
      {
        type: "price_multiplier",
        target: "memecoins",
        multiplier: 0.1,
      },
    ],
  },
];
