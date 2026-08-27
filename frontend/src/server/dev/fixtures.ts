export const devFixtures = {
  wallets: [
    {
      address: "0x1234567890123456789012345678901234567890",
      alias: "Dev Wallet 1",
    },
    {
      address: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
      alias: "Dev Stellar Wallet",
    }
  ],
  transactions: [
    {
      hash: "0xabc123",
      chainFamily: "evm",
      status: "completed",
      walletAddress: "0x1234567890123456789012345678901234567890",
      intent: "swap USDC to WETH",
    }
  ]
};
