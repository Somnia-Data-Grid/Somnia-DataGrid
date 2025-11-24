import { defineChain } from "viem";

/**
 * Somnia Dream Testnet configuration for Viem clients.
 */
export const somniaTestnet = defineChain({
  id: 50312,
  name: "Somnia Dream Testnet",
  network: "somnia-testnet",
  nativeCurrency: {
    name: "Somnia Test Token",
    symbol: "STT",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://dream-rpc.somnia.network"],
      webSocket: ["wss://dream-rpc.somnia.network/ws"],
    },
    public: {
      http: ["https://dream-rpc.somnia.network"],
      webSocket: ["wss://dream-rpc.somnia.network/ws"],
    },
  },
  blockExplorers: {
    default: {
      name: "Somnia Explorer",
      url: "https://somnia-testnet.socialscan.io",
    },
  },
  testnet: true,
});

