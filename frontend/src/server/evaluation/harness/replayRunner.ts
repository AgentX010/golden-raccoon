import { canonicalJson } from "./determinism";
import { assertTranscriptVersion, type AgentRunTranscript, type TranscriptStage } from "./transcript";

export class ReplayNetworkAccessError extends Error {
  readonly code = "replay_network_access_denied";

  constructor(stage?: string) {
    super(`Replay attempted an outbound request${stage ? ` during ${stage}` : ""}.`);
    this.name = "ReplayNetworkAccessError";
  }
}

export type ReplayOutput = {
  result: unknown;
  serialized: string;
  stages: TranscriptStage[];
  offline: true;
};

export function assertOfflineReplay(transcript: AgentRunTranscript): void {
  assertTranscriptVersion(transcript);
  for (const stage of transcript.stages) {
    for (const call of stage.calls) {
      if (!call.offline || call.kind === "provider") throw new ReplayNetworkAccessError(stage.name);
    }
  }
}

/** Reconstruct a transcript without invoking providers; the recorded result is the fixture input. */
export function replayTranscript(transcript: AgentRunTranscript): ReplayOutput {
  assertOfflineReplay(transcript);
  return {
    result: transcript.finalResult,
    serialized: canonicalJson(transcript.finalResult),
    stages: transcript.stages,
    offline: true,
  };
}

export function replayTwice(transcript: AgentRunTranscript): [ReplayOutput, ReplayOutput] {
  return [replayTranscript(transcript), replayTranscript(transcript)];
}
