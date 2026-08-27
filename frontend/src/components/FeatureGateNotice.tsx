"use client";

import { StatusBadge } from "@/components/a11y/StatusBadge";

export interface FeatureGateNoticeProps {
  feature: string;
  detail?: string;
}

/**
 * Presentation-only notice for a disabled capability. Feature authorization is
 * enforced server-side; this component only surfaces the disabled state to the
 * user. It never enables or bypasses a gate.
 */
export function FeatureGateNotice({ feature, detail }: FeatureGateNoticeProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/6 p-4" role="status">
      <div className="flex items-center gap-2">
        <StatusBadge tone="neutral">Disabled</StatusBadge>
        <span className="text-sm font-semibold text-white">{feature}</span>
      </div>
      <p className="mt-2 text-sm leading-6 text-white/58">
        {detail ?? "This capability is temporarily disabled."}
      </p>
    </div>
  );
}
