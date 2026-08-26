"use client";

import { useState } from "react";
import { Loader2, AlertTriangle, TrendingDown, TrendingUp } from "lucide-react";
import type { PortfolioSnapshot, PortfolioStressResult } from "@/server/types";
import { formatUsd } from "@/lib/format";

export function PortfolioStressPanel({
  portfolio,
}: {
  portfolio: PortfolioSnapshot;
}) {
  const [isStressing, setIsStressing] = useState(false);
  const [stressResult, setStressResult] = useState<PortfolioStressResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scenarioId, setScenarioId] = useState("market_crash_20");

  const scenarios = [
    { id: "market_crash_20", name: "20% Market Crash" },
    { id: "stablecoin_depeg", name: "Stablecoin Depeg (80c)" },
    { id: "memecoin_crash", name: "Memecoin Collapse" },
  ];

  async function runStressTest() {
    setIsStressing(true);
    setError(null);
    try {
      const response = await fetch("/api/portfolio/stress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshot: portfolio, scenarioId }),
      });

      if (!response.ok) {
        throw new Error("Failed to run stress test");
      }

      const data = await response.json();
      setStressResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsStressing(false);
    }
  }

  const getDeltaColor = (deltaUsd: number) => {
    if (deltaUsd < 0) return "text-red-400";
    if (deltaUsd > 0) return "text-emerald-400";
    return "text-white/70";
  };

  return (
    <section className="glass-panel mt-5 rounded-[28px] p-5" aria-label="Portfolio Stress Testing">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Stress Testing</h2>
          <p className="mt-1 text-sm text-white/50">Simulate market conditions on your portfolio.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="scenario-select" className="sr-only">Select Scenario</label>
          <select
            id="scenario-select"
            value={scenarioId}
            onChange={(e) => setScenarioId(e.target.value)}
            className="h-10 rounded-full border border-white/10 bg-black/20 px-4 text-sm text-white outline-none focus:border-[#d9a441]/60"
            aria-label="Stress test scenario"
          >
            {scenarios.map((s) => (
              <option key={s.id} value={s.id} className="bg-[#101012]">
                {s.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={runStressTest}
            disabled={isStressing}
            aria-busy={isStressing}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-white/10 px-5 text-sm font-semibold text-white transition hover:bg-white/20 disabled:opacity-50"
          >
            {isStressing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <AlertTriangle className="h-4 w-4" aria-hidden="true" />}
            {isStressing ? "Running..." : "Run Test"}
          </button>
        </div>
      </div>

      <div aria-live="polite" aria-atomic="true">
        {error && (
          <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200" role="alert">
            {error}
          </div>
        )}

        {stressResult && !error && (
          <div className="mt-5 space-y-4 rounded-2xl border border-white/5 bg-black/20 p-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <div className="text-sm text-white/50">Original Value</div>
                <div className="mt-1 text-2xl font-semibold">
                  {formatUsd(stressResult.delta.originalValueUsd, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div>
                <div className="text-sm text-white/50">Stressed Value</div>
                <div className="mt-1 text-2xl font-semibold">
                  {formatUsd(stressResult.delta.stressedValueUsd, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div>
                <div className="text-sm text-white/50">Delta</div>
                <div className={`mt-1 flex items-center gap-2 text-2xl font-semibold ${getDeltaColor(stressResult.delta.valueDeltaUsd)}`}>
                  {stressResult.delta.valueDeltaUsd < 0 ? (
                    <TrendingDown className="h-5 w-5" aria-hidden="true" />
                  ) : stressResult.delta.valueDeltaUsd > 0 ? (
                    <TrendingUp className="h-5 w-5" aria-hidden="true" />
                  ) : null}
                  {stressResult.delta.valueDeltaUsd < 0 ? "-" : "+"}
                  {formatUsd(Math.abs(stressResult.delta.valueDeltaUsd), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  <span className="text-lg">({stressResult.delta.percentageDelta > 0 ? "+" : ""}{stressResult.delta.percentageDelta.toFixed(2)}%)</span>
                </div>
              </div>
            </div>

            {stressResult.assumptions.length > 0 && (
              <div className="mt-4 border-t border-white/10 pt-4">
                <h3 className="text-sm font-semibold text-white/70">Assumptions</h3>
                <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-white/50">
                  {stressResult.assumptions.map((assumption, i) => (
                    <li key={i}>{assumption}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
