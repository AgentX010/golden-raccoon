import type { AgentStep, PortfolioSnapshot } from "../types";
import { summarizePortfolioRisk } from "../portfolio/riskScoring";
import type { TranscriptRecorder } from "../evaluation/harness";

export function analyzePortfolio(portfolio: PortfolioSnapshot): AgentStep {
  return {
    key: "analyze",
    label: "Analyze",
    status: "complete",
    detail: summarizePortfolioRisk(portfolio),
  };
}

export function recordAnalyzeStage(recorder: TranscriptRecorder | undefined, portfolio: PortfolioSnapshot, step: AgentStep) {
  recorder?.recordStage("analyze", { holdingCount: portfolio.holdings.length, riskScore: portfolio.riskScore }, step);
}
