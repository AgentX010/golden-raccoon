// frontend/src/components/OperationsSloPanel.tsx
"use client";

import React, { useEffect, useState } from "react";
import { AlertTriangle, Activity } from "lucide-react";

export function OperationsSloPanel() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json())
      .then((data) => setData(data))
      .catch((err) => console.error(err));
  }, []);

  if (!data) {
    return <div className="p-4 border border-white/10 rounded-lg">Loading SLOs...</div>;
  }

  const { slos = [], incidentTimeline = [] } = data;

  return (
    <div className="mt-8 space-y-8">
      <section className="rounded-lg border border-white/10 bg-white/6 p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <Activity className="h-4 w-4 text-[#d9a441]" />
          SLO Error Budgets
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {slos.map((slo: any) => (
            <div key={slo.id} className="rounded-md bg-black/24 p-4">
              <h3 className="text-white font-medium text-sm">{slo.name}</h3>
              <div className="mt-2 text-sm text-white/70">
                Target: {slo.target}%<br/>
                {slo.insufficientData ? (
                  <span className="text-yellow-400">Insufficient Data</span>
                ) : (
                  <>
                    Current SLI: {slo.sli?.toFixed(2)}%<br/>
                    Short Window Burn: {slo.burnRateShort?.toFixed(2)}x<br/>
                    Long Window Burn: {slo.burnRateLong?.toFixed(2)}x
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-white/10 bg-white/6 p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <AlertTriangle className="h-4 w-4 text-[#d9a441]" />
          Incident Timeline
        </div>
        <div className="mt-5 space-y-3">
          {incidentTimeline.length === 0 ? (
            <div className="text-sm text-white/50">No incidents to display.</div>
          ) : (
            incidentTimeline.map((ev: any) => (
              <div key={ev.id} className="p-3 bg-black/24 rounded-md text-sm">
                <div className="text-white font-medium capitalize">{ev.type}</div>
                <div className="text-white/60 mt-1">{ev.description}</div>
                <div className="text-xs text-white/40 mt-2">{new Date(ev.timestamp).toLocaleString()}</div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
