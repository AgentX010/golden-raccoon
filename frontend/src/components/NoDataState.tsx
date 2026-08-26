type NoDataStateProps = {
  title: string;
  detail: string;
  action?: string;
};

export function NoDataState({ title, detail, action = "Manual review required. No mock data used." }: NoDataStateProps) {
  return (
    <section 
      className="rounded-[24px] border border-[#d9a441]/25 bg-[#d9a441]/8 p-5"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="text-sm uppercase tracking-[0.18em] text-[#d9a441]">Data unavailable</div>
      <h3 className="mt-2 text-xl font-semibold">{title}</h3>
      <div className="mt-2 text-sm leading-6 text-white/52">{detail}</div>
      <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/58">{action}</div>
    </section>
  );
}
