import { getWatchlistIdentityKey } from "../src/server/identity/tokenIdentity";
import { addWatchlistEntriesBulk } from "../src/server/storage";

async function main() {
  console.log("Portability check");
  const key = getWatchlistIdentityKey({
    chain: "ethereum",
    contractAddress: "0x1234567890123456789012345678901234567890"
  });
  if (key !== "ethereum:mainnet:0x1234567890123456789012345678901234567890") {
    throw new Error("Identity key generation failed");
  }
  console.log("OK");
}
main().catch(console.error);
