import { deterministicHash, type DeterministicContext, createDeterministicContext } from "./determinism";
import { createTranscript, type AgentRunTranscript, type TranscriptCall, type TranscriptInput, type TranscriptStage, type TranscriptStageName } from "./transcript";

export type RecorderOptions = {
  enabled?: boolean;
  context?: DeterministicContext;
};

/** Recording is deliberately opt-in; production paths can construct this safely. */
export class TranscriptRecorder {
  private readonly enabled: boolean;
  private readonly context: DeterministicContext;
  private readonly stages: TranscriptStage[] = [];
  private readonly calls: TranscriptCall[] = [];

  constructor(private readonly input: Omit<TranscriptInput, "stages" | "finalResult">, options: RecorderOptions = {}) {
    this.enabled = options.enabled === true;
    this.context = options.context ?? createDeterministicContext(input.runId, 0);
  }

  recordStage(name: TranscriptStageName, stageInput: unknown, output: unknown, sourceSnapshotHashes: string[] = []): void {
    if (!this.enabled) return;
    this.stages.push({
      name,
      input: stageInput,
      output,
      sourceSnapshotHashes: [...sourceSnapshotHashes].sort(),
      calls: [],
    });
  }

  recordCall(call: Omit<TranscriptCall, "inputHash"> & { input: unknown; output?: unknown }): void {
    if (!this.enabled) return;
    const normalized: TranscriptCall = {
      kind: call.kind,
      name: call.name,
      inputHash: deterministicHash(call.input),
      outputHash: call.output === undefined ? undefined : deterministicHash(call.output),
      offline: call.offline,
    };
    this.calls.push(normalized);
    const stage = this.stages.at(-1);
    if (stage) stage.calls.push(normalized);
  }

  finish(finalResult: unknown): AgentRunTranscript | undefined {
    if (!this.enabled) return undefined;
    const now = this.context.now();
    return createTranscript({
      ...this.input,
      inputSnapshot: { ...(this.input.inputSnapshot as Record<string, unknown>), recordedAtMs: now },
      stages: this.stages,
      finalResult,
    });
  }

  isEnabled() {
    return this.enabled;
  }
}

export function createTranscriptRecorder(
  input: Omit<TranscriptInput, "stages" | "finalResult">,
  options?: RecorderOptions,
) {
  return new TranscriptRecorder(input, options);
}
