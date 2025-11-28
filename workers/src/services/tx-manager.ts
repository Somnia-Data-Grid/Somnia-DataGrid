/**
 * Transaction Manager
 * 
 * Serializes all blockchain transactions to avoid nonce conflicts.
 * All services should use this instead of calling SDK methods directly.
 */

import { createPublicClient, createWalletClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { waitForTransactionReceipt } from "viem/actions";
import { SDK, SchemaEncoder } from "@somnia-chain/streams";

// Somnia Testnet Chain
const somniaTestnet = {
  id: 50312,
  name: "Somnia Testnet",
  nativeCurrency: { name: "STT", symbol: "STT", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://dream-rpc.somnia.network"] },
  },
  blockExplorers: {
    default: { name: "Somnia Explorer", url: "https://somnia-testnet.socialscan.io" },
  },
} as const;

// Singleton instances
let publicClient: ReturnType<typeof createPublicClient> | null = null;
let walletClient: ReturnType<typeof createWalletClient> | null = null;
let sdk: SDK | null = null;

// Transaction queue
interface QueuedTx {
  id: string;
  execute: () => Promise<Hex | null>;
  resolve: (hash: Hex | null) => void;
  reject: (error: Error) => void;
}

const txQueue: QueuedTx[] = [];
let isProcessing = false;
let txCounter = 0;

/**
 * Initialize clients (call once at startup)
 */
export function initTxManager(): { publicClient: ReturnType<typeof createPublicClient>; sdk: SDK } {
  const rpcUrl = process.env.RPC_URL || "https://dream-rpc.somnia.network";
  const privateKey = process.env.PRIVATE_KEY;

  if (!privateKey) {
    throw new Error("PRIVATE_KEY environment variable is required");
  }

  const account = privateKeyToAccount(privateKey as `0x${string}`);

  publicClient = createPublicClient({
    chain: somniaTestnet,
    transport: http(rpcUrl),
  });

  walletClient = createWalletClient({
    account,
    chain: somniaTestnet,
    transport: http(rpcUrl),
  });

  // @ts-expect-error - SDK types are stricter than needed
  sdk = new SDK({ public: publicClient, wallet: walletClient });

  console.log("[TxManager] Initialized with account:", account.address);

  return { publicClient, sdk };
}

/**
 * Get the shared SDK instance
 */
export function getSDK(): SDK {
  if (!sdk) {
    initTxManager();
  }
  return sdk!;
}

/**
 * Get the shared public client
 */
export function getPublicClient(): ReturnType<typeof createPublicClient> {
  if (!publicClient) {
    initTxManager();
  }
  return publicClient!;
}

/**
 * Process the transaction queue sequentially
 */
async function processQueue(): Promise<void> {
  if (isProcessing || txQueue.length === 0) return;

  isProcessing = true;

  while (txQueue.length > 0) {
    const tx = txQueue.shift();
    if (!tx) break;

    try {
      const hash = await tx.execute();
      
      if (hash) {
        // Wait for confirmation before processing next tx
        await waitForTransactionReceipt(publicClient!, { hash });
      }
      
      tx.resolve(hash);
    } catch (error) {
      console.error(`[TxManager] TX ${tx.id} failed:`, error);
      tx.reject(error instanceof Error ? error : new Error(String(error)));
    }

    // Small delay between transactions
    await new Promise(r => setTimeout(r, 50));
  }

  isProcessing = false;
}

/**
 * Queue a transaction for execution
 * Returns a promise that resolves when the transaction is confirmed
 */
export function queueTransaction(
  name: string,
  execute: () => Promise<Hex | null>
): Promise<Hex | null> {
  return new Promise((resolve, reject) => {
    const id = `${name}-${++txCounter}`;
    
    txQueue.push({
      id,
      execute,
      resolve,
      reject,
    });

    // Start processing if not already running
    processQueue().catch(err => {
      console.error("[TxManager] Queue processing error:", err);
    });
  });
}

/**
 * Publish data and emit events (queued)
 */
export async function queueSetAndEmitEvents(
  name: string,
  dataStreams: Array<{ id: Hex; schemaId: Hex; data: Hex }>,
  eventStreams: Array<{ id: string; argumentTopics: Hex[]; data: Hex }>
): Promise<Hex | null> {
  return queueTransaction(name, async () => {
    const result = await getSDK().streams.setAndEmitEvents(dataStreams, eventStreams);
    
    if (result instanceof Error) {
      throw result;
    }
    
    return result;
  });
}

/**
 * Emit events only (queued)
 */
export async function queueEmitEvents(
  name: string,
  eventStreams: Array<{ id: string; argumentTopics: Hex[]; data: Hex }>
): Promise<Hex | null> {
  return queueTransaction(name, async () => {
    const result = await getSDK().streams.emitEvents(eventStreams);
    
    if (result instanceof Error) {
      throw result;
    }
    
    return result;
  });
}

/**
 * Get queue status
 */
export function getQueueStatus(): { pending: number; processing: boolean } {
  return {
    pending: txQueue.length,
    processing: isProcessing,
  };
}
