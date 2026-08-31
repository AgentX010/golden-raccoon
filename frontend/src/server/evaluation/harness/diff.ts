import { canonicalJson } from "./determinism";
import type { AgentRunTranscript } from "./transcript";

export type ReplayDifference = {
  stage: string;
  field: string;
  expected: unknown;
  actual: unknown;
};

function collect(expected: unknown, actual: unknown, path: string, differences: ReplayDifference[], stage: string) {
  if (canonicalJson(expected) === canonicalJson(actual)) return;
  if (Array.isArray(expected) && Array.isArray(actual)) {
    const length = Math.max(expected.length, actual.length);
    for (let index = 0; index < length; index += 1) collect(expected[index], actual[index], `${path}[${index}]`, differences, stage);
    return;
  }
  if (expected && actual && typeof expected === "object" && typeof actual === "object") {
    const keys = new Set([...Object.keys(expected as object), ...Object.keys(actual as object)]);
    for (const key of [...keys].sort()) collect((expected as Record<string, unknown>)[key], (actual as Record<string, unknown>)[key], path ? `${path}.${key}` : key, differences, stage);
    return;
  }
  differences.push({ stage, field: path || "$", expected, actual });
}

export function diffTranscripts(expected: AgentRunTranscript, actual: AgentRunTranscript) {
  const differences: ReplayDifference[] = [];
  const stageNames = new Set([...expected.stages.map((stage) => stage.name), ...actual.stages.map((stage) => stage.name)]);
  for (const name of [...stageNames].sort()) {
    const left = expected.stages.find((stage) => stage.name === name);
    const right = actual.stages.find((stage) => stage.name === name);
    collect(left, right, "", differences, name);
  }
  collect(expected.finalResult, actual.finalResult, "finalResult", differences, "final");
  return { identical: differences.length === 0, differences };
}
