import { NextResponse, NextRequest } from "next/server";
import { listWatchlist } from "@/server/discovery/watchlist";
import { resolveWalletSession } from "@/server/security/walletSession";
import { WatchlistExportFormat, WatchlistExportRow } from "@/server/types";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const wallet = url.searchParams.get("wallet");
  
  if (!wallet) {
    return NextResponse.json({ error: "wallet is required" }, { status: 400 });
  }

  const session = resolveWalletSession(request, { suppliedWallet: wallet });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const entries = listWatchlist(wallet);

  const exportedRows: WatchlistExportRow[] = entries.map(entry => ({
    version: "1.0.0",
    chain: entry.chain,
    network: entry.network,
    assetType: entry.assetType,
    contractAddress: entry.contractAddress,
    pairAddress: entry.pairAddress,
    symbol: entry.symbol,
    tokenName: entry.tokenName,
    assetKey: entry.assetKey,
    issuer: entry.issuer,
    source: entry.source,
    note: entry.note,
    createdAt: entry.createdAt,
  }));

  const format = url.searchParams.get("format") || "json";

  if (format === "csv") {
    // Generate CSV
    const headers = ["version", "chain", "network", "assetType", "contractAddress", "pairAddress", "symbol", "tokenName", "assetKey", "issuer", "source", "note", "createdAt"];
    
    // neutralize CSV formula injection
    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return "";
      let str = String(val);
      if (str.startsWith('=') || str.startsWith('+') || str.startsWith('-') || str.startsWith('@') || str.startsWith('\t') || str.startsWith('\r')) {
        str = "'" + str;
      }
      return `"${str.replace(/"/g, '""')}"`;
    };

    const csvRows = exportedRows.map(row => {
      return headers.map(header => escapeCsv((row as any)[header])).join(",");
    });
    const csvString = [headers.join(","), ...csvRows].join("\n");

    return new NextResponse(csvString, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="watchlist_${wallet}.csv"`
      }
    });
  }

  const exportData: WatchlistExportFormat = {
    version: "1.0.0",
    walletAddress: wallet,
    exportedAt: new Date().toISOString(),
    entries: exportedRows,
  };

  return NextResponse.json(exportData);
}
