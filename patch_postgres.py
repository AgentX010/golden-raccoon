import re

with open('frontend/src/server/storage/postgresAdapter.ts', 'r') as f:
    content = f.read()

# Add mirrorWatchlistEntryBulk to PostgresStorageAdapter class
bulk_method = """
  async mirrorWatchlistEntryBulk(entries: WatchlistEntry[]): Promise<void> {
    if (!this.pool || entries.length === 0) return;
    try {
      const client = await this.pool.connect();
      try {
        await client.query("BEGIN");
        for (const entry of entries) {
           await client.query(
             `
             INSERT INTO watchlist_entries (
               id, wallet_address, identity_key, chain, network,
               contract_address, pair_address, symbol, token_name, asset_key,
               issuer, asset_type, source, note, created_at, last_scanned_at,
               latest_scan_run_id, latest_classification, latest_score, latest_status
             ) VALUES (
               $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
               $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
             ) ON CONFLICT (wallet_address, identity_key) DO UPDATE SET
               chain = EXCLUDED.chain,
               network = EXCLUDED.network,
               contract_address = EXCLUDED.contract_address,
               pair_address = EXCLUDED.pair_address,
               symbol = EXCLUDED.symbol,
               token_name = EXCLUDED.token_name,
               asset_key = EXCLUDED.asset_key,
               issuer = EXCLUDED.issuer,
               asset_type = EXCLUDED.asset_type,
               source = EXCLUDED.source,
               note = EXCLUDED.note,
               created_at = EXCLUDED.created_at
             `,
             [
               entry.id, entry.walletAddress, entry.identityKey, entry.chain, entry.network || null,
               entry.contractAddress || null, entry.pairAddress || null, entry.symbol || null, entry.tokenName || null, entry.assetKey || null,
               entry.issuer || null, entry.assetType || null, entry.source, entry.note || null, entry.createdAt, entry.lastScannedAt || null,
               entry.latestScanRunId || null, entry.latestClassification || null, entry.latestScore ?? null, entry.latestStatus || null
             ]
           );
        }
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        console.error("Bulk insert failed, rolled back", err);
      } finally {
        client.release();
      }
    } catch (err) {
      console.warn("Could not acquire connection for mirrorWatchlistEntryBulk:", err);
    }
  }
"""

content = content.replace('async mirrorWatchlistEntry(entry: WatchlistEntry): Promise<void> {', bulk_method + '\n  async mirrorWatchlistEntry(entry: WatchlistEntry): Promise<void> {')

bulk_export = """
export function mirrorWatchlistEntryWriteBulk(entries: WatchlistEntry[]): void {
  void getPostgresStorageAdapter().mirrorWatchlistEntryBulk(entries);
}
"""

content = content.replace('export function mirrorWatchlistEntryWrite(entry: WatchlistEntry): void {', bulk_export + '\nexport function mirrorWatchlistEntryWrite(entry: WatchlistEntry): void {')

with open('frontend/src/server/storage/postgresAdapter.ts', 'w') as f:
    f.write(content)
