import { goldenTranscriptSet } from "../src/server/evaluation/goldenFixtures";
import { createTranscript, replayTranscript, scoreReplay } from "../src/server/evaluation/harness";

for (const fixture of goldenTranscriptSet) {
  const transcript = createTranscript({
    runId: fixture.name,
    chainFamily: fixture.chainFamily,
    network: fixture.network,
    assetIdentity: { asset: fixture.asset },
    inputSnapshot: { fixture: fixture.name, walletAddress: "fixture-wallet" },
    stages: [
      { name: "observe", input: { fixture: fixture.name }, output: { source: "fixture" }, sourceSnapshotHashes: [fixture.name], calls: [] },
      { name: "analyze", input: { score: 20 }, output: { score: 20 }, sourceSnapshotHashes: [], calls: [] },
      { name: "plan", input: { approvalOnly: true }, output: { approvalOnly: true }, sourceSnapshotHashes: [], calls: [] },
      { name: "decide", input: { asset: fixture.asset }, output: { recommendedAction: "hold", riskScore: 20 }, sourceSnapshotHashes: [], calls: [] },
    ],
    finalResult: { recommendedAction: "hold", riskScore: 20 },
  });
  const first = replayTranscript(transcript);
  const second = replayTranscript(transcript);
  if (first.serialized !== second.serialized || scoreReplay(transcript, { ...transcript, finalResult: JSON.parse(first.serialized), transcriptHash: transcript.transcriptHash }).classification !== "identical") {
    throw new Error(`golden replay regression: ${fixture.name}`);
  }
}
console.log(`Replayed ${goldenTranscriptSet.length} golden transcripts offline.`);
