import re

with open('frontend/src/app/api/watchlist/import/route.ts', 'r') as f:
    content = f.read()

content = content.replace('import { addWatchlistEntry } from "@/server/storage";', 'import { addWatchlistEntriesBulk } from "@/server/storage";')

apply_logic = """
  // Apply the valid rows
  const toAdd = [];
  for (const r of result.results) {
    if (r.status === "valid" || r.status === "duplicate") {
       toAdd.push({
         walletAddress: wallet,
         chain: r.row.chain!,
         network: r.row.network,
         assetType: r.row.assetType as any,
         contractAddress: r.row.contractAddress,
         pairAddress: r.row.pairAddress,
         symbol: r.row.symbol,
         tokenName: r.row.tokenName,
         assetKey: r.row.assetKey,
         issuer: r.row.issuer,
         source: r.row.source as any || "manual_watchlist",
         note: r.row.note,
         identityKey: r.canonicalIdentityKey!
       });
    }
  }

  const { appliedCount } = addWatchlistEntriesBulk(toAdd);
  return NextResponse.json({ success: true, appliedCount, result });
"""

# Replace the end part of the file
content = re.sub(r'  // Apply the valid rows.*', apply_logic + '\n}', content, flags=re.DOTALL)

with open('frontend/src/app/api/watchlist/import/route.ts', 'w') as f:
    f.write(content)
