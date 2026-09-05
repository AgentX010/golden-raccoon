import type { AgentDecision, AgentStep, PortfolioSnapshot } from "../types";
import type { TranscriptRecorder } from "../evaluation/harness";

export function decideAction(portfolio: PortfolioSnapshot): {
  step: AgentStep;
  decision: AgentDecision;
} {
  const meme = portfolio.holdings.find((holding) => holding.symbol === "MEME");
  const riskScore = Math.max(portfolio.riskScore, meme?.riskScore ?? 0);

  const decision: AgentDecision = {
    walletAddress: portfolio.walletAddress,
    riskScore,
    summary: "Reduce MEME exposure before portfolio risk compounds.",
    decision: "Move 30% MEME exposure into USDC.",
    reasoning: [
      "Whale selling increased in the last hour.",
      "Liquidity dropped while holder concentration remains high.",
      "Social sentiment turned negative.",
      "MEME represents 42% of the demo portfolio.",
    ],
    suggestedAction: {
      type: "swap_to_stablecoin",
      fromToken: "MEME",
      toToken: "USDC",
      percent: 30,
    },
    confidence: 0.78,
    status: "pending",
    createdAt: new Date().toISOString(),
  };

  return {
    step: {
      key: "decide",
      label: "Decision",
      status: "complete",
      detail: `${decision.suggestedAction.percent}% ${decision.suggestedAction.fromToken} -> ${decision.suggestedAction.toToken} is recommended.`,
    },
    decision,
  };
}

export function recordDecideStage(recorder: TranscriptRecorder | undefined, portfolio: PortfolioSnapshot, decision: AgentDecision) {
  recorder?.recordStage("decide", { walletAddress: portfolio.walletAddress, riskScore: portfolio.riskScore }, decision);
}
