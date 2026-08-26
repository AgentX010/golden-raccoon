import re

with open('frontend/src/server/storage/adapters/supabase.ts', 'r') as f:
    content = f.read()

content = content.replace('X402PaymentReceipt,\n} from "@/server/types";', 'X402PaymentReceipt,\n  WatchlistEntry,\n} from "@/server/types";')

methods = """
  async addWatchlistEntriesBulk(entries: WatchlistEntry[]): Promise<{ added: WatchlistEntry[] }> {
    if (entries.length === 0) return { added: [] };
    const { data, error } = await this.client
      .from("watchlist_entries")
      .upsert(entries.map(e => ({
        id: e.id,
        wallet_address: e.walletAddress,
        identity_key: e.identityKey,
        chain: e.chain,
        network: e.network,
        contract_address: e.contractAddress,
        pair_address: e.pairAddress,
        symbol: e.symbol,
        token_name: e.tokenName,
        asset_key: e.assetKey,
        issuer: e.issuer,
        asset_type: e.assetType,
        source: e.source,
        note: e.note,
        created_at: e.createdAt,
      })), { onConflict: "wallet_address, identity_key", ignoreDuplicates: true })
      .select();
    
    if (error) {
      console.error("Supabase addWatchlistEntriesBulk error", error);
      return { added: [] }; // Could throw, but fallback handles it
    }
    
    const added = (data || []).map(row => ({
      ...entries.find(e => e.walletAddress === row.wallet_address && e.identityKey === row.identity_key)!,
    }));
    return { added };
  }
"""

content = content.replace('async performHealthProbe(): Promise<HealthProbeResult> {', methods + '\n  async performHealthProbe(): Promise<HealthProbeResult> {')

with open('frontend/src/server/storage/adapters/supabase.ts', 'w') as f:
    f.write(content)
