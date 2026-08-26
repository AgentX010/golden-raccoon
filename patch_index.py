import re

with open('frontend/src/server/storage/index.ts', 'r') as f:
    content = f.read()

content = content.replace('mirrorWatchlistEntryWrite,', 'mirrorWatchlistEntryWrite,\n  mirrorWatchlistEntryWriteBulk,')

bulk_storage = """
export function addWatchlistEntriesBulk(inputs: CreateWatchlistInput[]): { appliedCount: number } {
  if (inputs.length === 0) return { appliedCount: 0 };
  
  const entries: WatchlistEntry[] = [];
  const existingStore = getWatchlistEntries();
  const added: WatchlistEntry[] = [];

  for (const input of inputs) {
    const normalizedWallet = input.walletAddress.trim();
    const existing = existingStore.find(
      (entry) =>
        entry.walletAddress.toLowerCase() === normalizedWallet.toLowerCase() &&
        entry.identityKey === input.identityKey,
    );

    if (existing) {
      continue;
    }

    const entry: WatchlistEntry = {
      id: createRecordId("watch"),
      walletAddress: normalizedWallet,
      identityKey: input.identityKey,
      chain: input.chain,
      network: input.network,
      contractAddress: input.contractAddress,
      pairAddress: input.pairAddress,
      symbol: input.symbol,
      tokenName: input.tokenName,
      assetKey: input.assetKey,
      issuer: input.issuer,
      assetType: input.assetType,
      source: input.source,
      note: input.note,
      createdAt: new Date().toISOString(),
    };
    added.push(entry);
  }

  if (added.length > 0) {
    existingStore.unshift(...added);
    mirrorWatchlistEntryWriteBulk(added);
  }

  return { appliedCount: added.length };
}
"""

# Replace the previous definition of addWatchlistEntriesBulk
content = re.sub(r'export async function addWatchlistEntriesBulk.*?^}$', bulk_storage, content, flags=re.MULTILINE | re.DOTALL)

if 'addWatchlistEntriesBulk' not in content:
    content += '\n' + bulk_storage

with open('frontend/src/server/storage/index.ts', 'w') as f:
    f.write(content)
