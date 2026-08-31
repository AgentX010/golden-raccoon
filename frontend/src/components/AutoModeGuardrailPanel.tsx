"use client";

import { useState } from "react";

type Props = { state: { engaged: boolean; reason?: string; actor?: string } };

export function AutoModeGuardrailPanel({ state }: Props) {
  const [expanded, setExpanded] = useState(false);
  return (
    <section aria-label="Auto Mode guardrails">
      <button type="button" onClick={() => setExpanded((value) => !value)}>
        {state.engaged ? "Auto Mode halted" : "Auto Mode guardrails active"}
      </button>
      {expanded ? <p>{state.engaged ? `${state.reason ?? "Kill switch engaged"}${state.actor ? ` by ${state.actor}` : ""}.` : "Shadow decisions are approval-only and produce a verifiable proof."}</p> : null}
    </section>
  );
}

export default AutoModeGuardrailPanel;
