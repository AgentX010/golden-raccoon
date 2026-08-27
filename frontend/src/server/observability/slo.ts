// frontend/src/server/observability/slo.ts
export interface SloDefinition {
  id: string;
  name: string;
  target: number; // e.g. 99.9
  windowDays: number;
}

export const slos: SloDefinition[] = [
  { id: "slo-scan-completion", name: "Scan Completion", target: 99.0, windowDays: 30 },
  { id: "slo-quote-availability", name: "Quote Availability", target: 99.5, windowDays: 30 },
  { id: "slo-simulation-success", name: "Simulation Success", target: 99.0, windowDays: 30 },
  { id: "slo-transaction-observation", name: "Transaction Observation", target: 99.9, windowDays: 30 },
  { id: "slo-stellar-ledger-lag", name: "Stellar Ledger Lag", target: 99.0, windowDays: 30 },
  { id: "slo-api-latency", name: "API Latency", target: 99.0, windowDays: 30 }
];

export interface SloResult {
  id: string;
  sli: number | null;
  target: number;
  burnRateShort: number | null;
  burnRateLong: number | null;
  insufficientData: boolean;
}

export function calculateSlo(
  def: SloDefinition,
  successes: number,
  total: number,
  shortSuccesses: number,
  shortTotal: number
): SloResult {
  const MIN_SAMPLE = 100;

  if (total < MIN_SAMPLE) {
    return {
      id: def.id,
      sli: null,
      target: def.target,
      burnRateShort: null,
      burnRateLong: null,
      insufficientData: true,
    };
  }

  const sli = (successes / total) * 100;
  const errorBudget = 100 - def.target;
  const errorRate = 100 - sli;
  const burnRateLong = errorRate / (errorBudget || 1);

  let burnRateShort: number | null = null;
  if (shortTotal >= MIN_SAMPLE) {
    const shortErrorRate = 100 - (shortSuccesses / shortTotal) * 100;
    burnRateShort = shortErrorRate / (errorBudget || 1);
  }

  return {
    id: def.id,
    sli,
    target: def.target,
    burnRateShort,
    burnRateLong,
    insufficientData: false,
  };
}
