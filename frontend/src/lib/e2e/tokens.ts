export const E2E_SEED_EPOCH = "2024-01-01T00:00:00.000Z";
export const EVM_WALLET = "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18";
export const STELLAR_WALLET = "GDXHOKE7W6FZ6N5K4J7H3E5F2G8A9B1C2D4E5F6G7H8I9J0K1L2M3N4O5P6Q";
export const evmTokens = { meme: { symbol: "MEME", address: "0x1234567890abcdef1234567890abcdef12345678", chain: "base" } } as const;
export const stellarTokens = {
  contract: { symbol: "RST", address: "CDLZFC3SYJYDZT7K4VJHRJ6J3Z5H3KJY3J3Z5H3KJY3J3Z5H3KJY3J3Z5", chain: "stellar-testnet" },
  nativeXlm: { symbol: "XLM", address: "native", chain: "stellar-testnet" },
  classicUsdc: { symbol: "USDC", address: "USDC:GBBD47IF6LWK7P7MDEVSC6547CCEE7SGZ6WWOKY3DBWECHSL44JE7QBJ", chain: "stellar-testnet" },
} as const;
