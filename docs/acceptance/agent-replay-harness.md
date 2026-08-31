# Agent replay harness

Set `AGENT_REPLAY_RECORDING=1` to attach a transcript to an orchestration run;
the default is disabled. Transcripts are schema-versioned, redacted before
hashing, and retain chain family, network, and asset identity. The replay
runner reads only recorded stages and rejects provider calls, so the
`agent-replay-check` script is safe to run offline.

Use `npm run test:agent-replay` to replay the EVM and Stellar golden fixtures.
Review the structured stage/field diff and add a migration note before
intentionally re-baselining a fixture.
