import re

with open('frontend/src/server/storage/adapters/types.ts', 'r') as f:
    content = f.read()

# Add WatchlistEntry to import
content = content.replace('X402PaymentReceipt,\n} from "@/server/types";', 'X402PaymentReceipt,\n  WatchlistEntry,\n} from "@/server/types";')

methods = """
  // ─── Watchlist ───────────────────────────────────────────────────
  addWatchlistEntriesBulk?(entries: WatchlistEntry[]): Promise<{ added: WatchlistEntry[] }>;
"""

content = content.replace('performHealthProbe(): Promise<HealthProbeResult>;', 'performHealthProbe(): Promise<HealthProbeResult>;' + methods)

with open('frontend/src/server/storage/adapters/types.ts', 'w') as f:
    f.write(content)
