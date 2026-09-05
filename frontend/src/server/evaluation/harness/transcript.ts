import type { AgentResult } from "@/server/types";
import { canonicalJson, deterministicHash } from "./determinism";
import { redactTranscript } from "./redaction";

export const TRANSCRIPT_SCHEMA_VERSION = 1 as const;
export type TranscriptStageName = "observe" | "analyze" | "plan" | "decide";

export type TranscriptCall = {
  kind: "provider" | "tool" | "sub_agent";
  name: string;
  inputHash: string;
  outputHash?: string;
  offline: boolean;
};

export type TranscriptStage = {
  name: TranscriptStageName;
  input: unknown;
  output: unknown;
  sourceSnapshotHashes: string[];
  calls: TranscriptCall[];
};

export type AgentRunTranscript = {
  schemaVersion: typeof TRANSCRIPT_SCHEMA_VERSION;
  runId: string;
  chainFamily: "evm" | "stellar";
  network: string;
  assetIdentity: { asset: string; contractAddress?: string; issuer?: string };
  inputSnapshot: unknown;
  stages: TranscriptStage[];
  finalResult: unknown;
  transcriptHash: string;
};

export type TranscriptInput = Omit<AgentRunTranscript, "schemaVersion" | "transcriptHash"> & {
  schemaVersion?: typeof TRANSCRIPT_SCHEMA_VERSION;
};

export function createTranscript(input: TranscriptInput): AgentRunTranscript {
  const redacted = redactTranscript({ ...input, schemaVersion: TRANSCRIPT_SCHEMA_VERSION });
  const withoutHash = { ...redacted } as Omit<AgentRunTranscript, "transcriptHash">;
  return {
    ...withoutHash,
    transcriptHash: deterministicHash(withoutHash),
  };
}

export function serializeTranscript(transcript: AgentRunTranscript): string {
  return canonicalJson(transcript);
}

export function assertTranscriptVersion(transcript: AgentRunTranscript): void {
  if (transcript.schemaVersion !== TRANSCRIPT_SCHEMA_VERSION) {
    throw new Error(`unsupported_transcript_schema:${transcript.schemaVersion}`);
  }
  if (!transcript.chainFamily || !transcript.network || !transcript.assetIdentity?.asset) {
    throw new Error("invalid_transcript_identity");
  }
}

export function transcriptFromAgentResult(input: {
  runId: string;
  chainFamily: "evm" | "stellar";
  network: string;
  asset: string;
  inputSnapshot: unknown;
  stages: TranscriptStage[];
  result: AgentResult;
}): AgentRunTranscript {
  return createTranscript({
    runId: input.runId,
    chainFamily: input.chainFamily,
    network: input.network,
    assetIdentity: { asset: input.asset },
    inputSnapshot: input.inputSnapshot,
    stages: input.stages,
    finalResult: input.result,
  });
}
