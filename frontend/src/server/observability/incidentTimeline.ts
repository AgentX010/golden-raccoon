// frontend/src/server/observability/incidentTimeline.ts

export type IncidentEventType = "open" | "update" | "recover";

export interface IncidentEvent {
  id: string;
  timestamp: number;
  type: IncidentEventType;
  description: string;
}

export function generateIncidentTimeline(rawEvents: any[]): IncidentEvent[] {
  // deduplicate and remove sensitive
  const timeline: IncidentEvent[] = [];
  const seenIds = new Set<string>();

  // sort by timestamp
  const sorted = [...rawEvents].sort((a, b) => a.timestamp - b.timestamp);

  for (const ev of sorted) {
    if (!seenIds.has(ev.id)) {
      seenIds.add(ev.id);
      timeline.push({
        id: ev.id,
        timestamp: ev.timestamp,
        type: ev.type,
        // redact sensitive info (assuming description might have wallet/payload/asset)
        description: redact(ev.description || ""),
      });
    } else {
      // update latest state if it's an update or recover
      const existing = timeline.find(e => e.id === ev.id);
      if (existing && ev.type !== "open") {
        existing.type = ev.type;
        existing.description = redact(ev.description || "");
        existing.timestamp = ev.timestamp; // update timestamp to latest
      }
    }
  }

  // Immutable events: map to a new array of frozen objects if we really wanted, but regular returning array is fine.
  return timeline;
}

function redact(text: string): string {
  // basic redaction of wallet, asset, payload
  return text
    .replace(/0x[a-fA-F0-9]{40}/g, "[REDACTED_WALLET]")
    .replace(/"payload":\s*\{.*?\}/g, '"payload": [REDACTED]')
    .replace(/asset=[a-zA-Z0-9]+/g, "asset=[REDACTED]");
}
