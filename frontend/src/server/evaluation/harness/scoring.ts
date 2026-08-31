import { diffTranscripts, type ReplayDifference } from "./diff";
import type { AgentRunTranscript } from "./transcript";

export type DivergenceClassification = "identical" | "tolerable_drift" | "regression";
export type ReplayScore = {
  classification: DivergenceClassification;
  differences: ReplayDifference[];
  score: number;
};

export function classifyDifferences(differences: ReplayDifference[]): DivergenceClassification {
  if (differences.length === 0) return "identical";
  const tolerable = differences.every((difference) =>
    difference.field.endsWith("riskScore") &&
    typeof difference.expected === "number" &&
    typeof difference.actual === "number" &&
    Math.abs(difference.expected - difference.actual) <= 3,
  );
  return tolerable ? "tolerable_drift" : "regression";
}

export function scoreReplay(expected: AgentRunTranscript, actual: AgentRunTranscript): ReplayScore {
  const diff = diffTranscripts(expected, actual);
  const classification = classifyDifferences(diff.differences);
  return {
    classification,
    differences: diff.differences,
    score: classification === "identical" ? 1 : classification === "tolerable_drift" ? 0.75 : 0,
  };
}

export function assertNoRegression(score: ReplayScore): void {
  if (score.classification === "regression") {
    const first = score.differences[0];
    throw new Error(`golden_regression:${first?.stage ?? "unknown"}.${first?.field ?? "unknown"}`);
  }
}
