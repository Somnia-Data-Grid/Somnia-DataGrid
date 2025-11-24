import {
  createPublicClient,
  createWalletClient,
  http,
  webSocket,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { somniaTestnet } from "./chain";

function getEnvVar(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getRpcUrl() {
  return getEnvVar("RPC_URL");
}

function getWsUrl() {
  return (
    process.env.WEBSOCKET_URL ??
    process.env.NEXT_PUBLIC_WEBSOCKET_URL ??
    getEnvVar("WEBSOCKET_URL")
  );
}

export function getPublicHttpClient(): PublicClient {
  return createPublicClient({
    chain: somniaTestnet,
    transport: http(getRpcUrl()),
  });
}

export function getPublicWSClient(): PublicClient {
  return createPublicClient({
    chain: somniaTestnet,
    transport: webSocket(getWsUrl()),
  });
}

export function getWalletClient(): WalletClient {
  const privateKey = getEnvVar("PRIVATE_KEY");

  if (!privateKey.startsWith("0x")) {
    throw new Error("PRIVATE_KEY must be a hex string that starts with 0x");
  }

  const account = privateKeyToAccount(privateKey as `0x${string}`);

  return createWalletClient({
    account,
    chain: somniaTestnet,
    transport: http(getRpcUrl()),
  });
}

export function getPublisherAddress() {
  return getEnvVar("PUBLISHER_ADDRESS");
}

