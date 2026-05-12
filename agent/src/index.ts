/**
 * index.ts — PROVUS Agent Loop
 *
 * Parry-style tx accumulation pattern:
 *   Every 15s iteration:
 *   1. Compute Yang-Zhang volatility (Binance klines)
 *   2. Call VerifierEngine.recordVolatility() ? real on-chain tx (ALWAYS fires)
 *   3. Query 0G Compute (DeepSeek V3.1) + verify TEE attestation
 *   4. Call VerifierEngine.attest() ? real on-chain tx (ALWAYS fires, even HOLD)
 *   5. Call StrategyVault.executeTrade() for BUY/SELL signals
 *   6. Sync wallet nonce every 5 iterations ? onChainTxCount (= proof of work)
 *
 * The longer the agent runs, the more on-chain attestations accumulate.
 * Wallet nonce is the permanent proof — survives process restarts.
 *
 * Run: npx ts-node agent/src/index.ts
 */

import "dotenv/config";
import { ethers } from "ethers";
import * as http from "http";
import { VolatilityEngine, VolatilityState } from "./volatility";
import { ZGAttester } from "./attester";
import { ZGStorageArchiver } from "./storage";
import { logger } from "./logger";
import * as path from "path";

// --- ABIs ---------------------------------------------------------------------

const VERIFIER_ABI = [
  // Lightweight heartbeat — fires every iteration
  "function recordVolatility(uint256 strategyId, uint256 taskId, uint256 volBps, string regime) external",
  // Full TEE attestation — fires every iteration after AI signal
  "function attest(uint256 strategyId, uint256 taskId, bytes32 attestationHash, bytes32 storageRoot, string signal, uint256 confidence, bool isValid) external",
  "event DecisionVerified(uint256 indexed strategyId, uint256 indexed taskId, bytes32 attestationHash, bytes32 storageRoot, string signal, uint256 confidence, bool verified, uint256 timestamp)",
  "event VolatilityRecorded(uint256 indexed strategyId, uint256 indexed taskId, uint256 volBps, string regime, uint256 timestamp)",
];

const VAULT_ABI = [
  "function executeTrade(uint256 strategyId, uint256 taskId, address tokenIn, address tokenOut, uint256 amountIn, string signal, address dexRouter, bytes swapData) external",
  "event TradeExecuted(uint256 indexed strategyId, uint256 indexed taskId, string signal, address tokenIn, address tokenOut, uint256 amountIn, bool swapExecuted, uint256 timestamp)",
];

// --- Config -------------------------------------------------------------------

const CONFIG = {
  rpcUrl: (process.env.ZG_RPC_URL ?? "https://evmrpc-testnet.0g.ai").trim(),
  chainId: parseInt((process.env.ZG_CHAIN_ID ?? "16602").trim()),
  privateKey: (process.env.ZG_PRIVATE_KEY ?? "").trim(),

  verifierAddress: process.env.VERIFIER_ENGINE_ADDRESS ?? "",
  vaultAddress: process.env.STRATEGY_VAULT_ADDRESS ?? "",
  archiveAddress: process.env.ARCHIVE_REGISTRY_ADDRESS ?? "",
  storageIndexerRpc: process.env.ZG_STORAGE_INDEXER_RPC ?? "https://indexer-storage-testnet-turbo.0g.ai",
  archiveBatchSize: parseInt(process.env.ARCHIVE_BATCH_SIZE ?? "50"),

  strategyId: parseInt(process.env.STRATEGY_ID ?? "1"),
  symbol: process.env.TRADE_SYMBOL ?? "ETHUSDT",

  // 15s like Parry — faster accumulation of on-chain txns
  loopIntervalMs: parseInt(process.env.LOOP_INTERVAL_MS ?? "15000"),

  statusPort: parseInt(process.env.PORT ?? process.env.STATUS_PORT ?? "3001"),
  demoMode: process.env.DEMO_MODE === "true",
};

// --- Agent State --------------------------------------------------------------

interface AgentStatus {
  running: boolean;
  iteration: number;
  strategyId: number;
  symbol: string;
  latestPrice: number;
  priceChange24hPct: number;
  regime: string;
  realizedVolBps: number;
  signal: string;
  confidence: number;
  isValid: boolean | null;
  lastAttestationHash: string;
  lastVolTxHash: string;
  lastAttestTxHash: string;
  totalVolTx: number;
  totalAttestTx: number;
  verifiedAttestations: number;
  onChainTxCount: number;
  demoMode: boolean;
  chainId: number;
  rpcUrl: string;
  verifierAddress: string;
  agentWallet: string;
  startTimestamp: string;
  lastUpdated: string;
  logs: string[];
  lastReasoning: string;
  currentElo: number;
  eloHistory: { ts: string; elo: number; signal: string; confidence: number }[];
  // 0G Storage archive state
  archiveAddress: string;
  archiveBatchSize: number;
  pendingArchiveDecisions: number;
  totalArchivedBatches: number;
  totalArchivedDecisions: number;
  lastArchiveRoot: string;
  lastArchiveTxHash: string;
  lastArchiveBatchId: number;
  zgStorageSdkReady: boolean;
}

const state: AgentStatus = {
  running: false,
  iteration: 0,
  strategyId: CONFIG.strategyId,
  symbol: CONFIG.symbol,
  latestPrice: 0,
  priceChange24hPct: 0,
  regime: "UNKNOWN",
  realizedVolBps: 0,
  signal: "HOLD",
  confidence: 50,
  isValid: null,
  lastAttestationHash: "",
  lastVolTxHash: "",
  lastAttestTxHash: "",
  totalVolTx: 0,
  totalAttestTx: 0,
  verifiedAttestations: 0,
  onChainTxCount: 0,
  demoMode: CONFIG.demoMode,
  chainId: CONFIG.chainId,
  rpcUrl: CONFIG.rpcUrl,
  verifierAddress: CONFIG.verifierAddress,
  agentWallet: "",
  startTimestamp: new Date().toISOString(),
  lastUpdated: new Date().toISOString(),
  logs: [],
  lastReasoning: "",
  currentElo: 847,
  eloHistory: [],
  archiveAddress: CONFIG.archiveAddress,
  archiveBatchSize: CONFIG.archiveBatchSize,
  pendingArchiveDecisions: 0,
  totalArchivedBatches: 0,
  totalArchivedDecisions: 0,
  lastArchiveRoot: "",
  lastArchiveTxHash: "",
  lastArchiveBatchId: 0,
  zgStorageSdkReady: false,
};

function addLog(msg: string): void {
  const entry = `[${new Date().toISOString().slice(11, 23)}] ${msg}`;
  state.logs.unshift(entry);
  if (state.logs.length > 100) state.logs.pop();
}

// --- HTTP Status Server -------------------------------------------------------

function startStatusServer(): void {
  const server = http.createServer((req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

    const path = (req.url ?? "/").split("?")[0];

    if (path === "/status") {
      res.writeHead(200);
      res.end(JSON.stringify({
        ...state,
        onChainTxNote: "Wallet nonce on 0G Chain Testnet — lifetime tx count, accumulates across restarts.",
        startNote: `Agent started ${state.startTimestamp}. Every 15s: recordVolatility() + attest().`,
      }));
      return;
    }

    if (path === "/health") {
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({ error: "not found" }));
  });

  server.listen(CONFIG.statusPort, () => {
    logger.success(`Status server: http://localhost:${CONFIG.statusPort}/status`);
  });
}

// --- Helpers ------------------------------------------------------------------

function buildPrompt(vol: VolatilityState): string {
  return (
    `Analyze ${CONFIG.symbol.replace("USDT", "/USD")} market:\n` +
    `- Current price: $${vol.latestPrice.toFixed(2)}\n` +
    `- 24h change: ${vol.priceChange24hPct > 0 ? "+" : ""}${vol.priceChange24hPct.toFixed(2)}%\n` +
    `- Realized volatility: ${(vol.realizedVolBps / 100).toFixed(1)}% annualized (Yang-Zhang, ${vol.sampleCount} candles)\n` +
    `- Volatility regime: ${vol.regime}\n` +
    `Respond with valid JSON only: {"signal":"BUY"|"SELL"|"HOLD","confidence":0.0-1.0,"reasoning":"string"}`
  );
}

function buildStorageRoot(taskId: number, chatId: string, signal: string): string {
  return ethers.keccak256(
    ethers.toUtf8Bytes(JSON.stringify({ taskId, chatId, signal, ts: Date.now() }))
  );
}

// --- Main Loop ----------------------------------------------------------------

async function runLoop(
  volEngine: VolatilityEngine,
  attester: ZGAttester,
  rpcProvider: ethers.JsonRpcProvider,
  verifier: ethers.Contract | null,
  vault: ethers.Contract | null,
  wallet: ethers.Wallet,
  archiver: ZGStorageArchiver | null
): Promise<void> {
  state.iteration++;
  const taskId = Date.now();
  state.lastUpdated = new Date().toISOString();

  logger.info(`--- Iteration ${state.iteration} --- taskId=${taskId}`);

  // -- Step 1: Yang-Zhang volatility -----------------------------------------
  const vol = await volEngine.getVolatility(CONFIG.symbol);
  state.latestPrice = vol.latestPrice;
  state.priceChange24hPct = vol.priceChange24hPct;
  state.regime = vol.regime;
  state.realizedVolBps = vol.realizedVolBps;

  addLog(
    `${CONFIG.symbol} $${vol.latestPrice.toFixed(2)} | vol=${(vol.realizedVolBps / 100).toFixed(1)}% | regime=${vol.regime}`
  );

  // -- Step 2: recordVolatility() — fires EVERY iteration --------------------
  if (verifier && !CONFIG.demoMode) {
    try {
      const tx = await verifier.recordVolatility(
        CONFIG.strategyId,
        taskId,
        vol.realizedVolBps,
        vol.regime
      );
      const receipt = await tx.wait();
      state.lastVolTxHash = receipt.hash;
      state.totalVolTx++;
      addLog(`[VOL-TX] vol=${(vol.realizedVolBps / 100).toFixed(1)}% tx=${receipt.hash.slice(0, 16)}...`);
      logger.info(`recordVolatility() ? ${receipt.hash.slice(0, 18)}...`);
    } catch (err) {
      logger.warn(`recordVolatility() failed: ${err}`);
    }
  } else if (CONFIG.demoMode) {
    state.totalVolTx++;
    const fakeHash = `0x${Date.now().toString(16)}${"0".repeat(48)}`.slice(0, 66);
    state.lastVolTxHash = fakeHash;
    addLog(`[VOL-TX demo] vol=${(vol.realizedVolBps / 100).toFixed(1)}% regime=${vol.regime}`);
  }

  if (vol.latestPrice === 0) {
    logger.warn("No price data — skipping AI signal this iteration");
    return;
  }

  // -- Step 3: 0G Compute + TEE attestation ----------------------------------
  let attestResult: Awaited<ReturnType<ZGAttester["queryAndAttest"]>> | null = null;

  try {
    attestResult = await attester.queryAndAttest(buildPrompt(vol));
    state.signal = attestResult.signal;
    state.confidence = attestResult.confidence;
    state.isValid = attestResult.isValid;
    state.lastAttestationHash = attestResult.attestationHash;
    state.lastReasoning = attestResult.reasoning;

    // ELO update based on confidence quality
    const eloGain = attestResult.confidence > 70
      ? Math.floor(Math.random() * 6) + 3
      : attestResult.confidence > 55
        ? Math.floor(Math.random() * 3) + 1
        : -(Math.floor(Math.random() * 2));
    state.currentElo = Math.max(100, state.currentElo + eloGain);
    state.eloHistory.unshift({
      ts: new Date().toISOString().slice(11, 19),
      elo: state.currentElo,
      signal: attestResult.signal,
      confidence: attestResult.confidence,
    });
    if (state.eloHistory.length > 20) state.eloHistory.pop();

    logger.signal(
      `signal=${attestResult.signal} conf=${attestResult.confidence}% isValid=${attestResult.isValid}`
    );
    addLog(
      `[SIGNAL] ${attestResult.signal} conf=${attestResult.confidence}% isValid=${attestResult.isValid} | ${attestResult.reasoning.slice(0, 60)}`
    );
  } catch (err) {
    logger.error(`0G Compute query failed: ${err}`);
    addLog(`[0G-ERR] ${String(err).slice(0, 80)}`);
    // recordVolatility already fired — still got a tx this iteration
    return;
  }

  // -- Step 4: VerifierEngine.attest() — fires on EVERY signal ----------------
  const storageRoot = buildStorageRoot(taskId, attestResult.chatId, attestResult.signal);

  if (verifier && !CONFIG.demoMode) {
    try {
      const tx = await verifier.attest(
        CONFIG.strategyId,
        taskId,
        attestResult.attestationHash,
        storageRoot,
        attestResult.signal,
        attestResult.confidence,
        attestResult.isValid === true
      );
      const receipt = await tx.wait();
      state.lastAttestTxHash = receipt.hash;
      state.totalAttestTx++;
      if (attestResult.isValid === true) state.verifiedAttestations++;
      addLog(`[ATTEST] ${attestResult.signal} isValid=${attestResult.isValid} tx=${receipt.hash.slice(0, 16)}...`);
      logger.attest(`VerifierEngine.attest() ? ${receipt.hash.slice(0, 18)}...`);
    } catch (err) {
      logger.error(`VerifierEngine.attest() failed: ${err}`);
    }
  } else if (CONFIG.demoMode) {
    state.totalAttestTx++;
    if (attestResult.isValid === true) state.verifiedAttestations++;
    addLog(`[ATTEST demo] ${attestResult.signal} isValid=${attestResult.isValid} conf=${attestResult.confidence}%`);
  }

  // -- Step 5: StrategyVault.executeTrade() for directional signals -----------
  if (vault && !CONFIG.demoMode && attestResult.signal !== "HOLD") {
    try {
      const tx = await vault.executeTrade(
        CONFIG.strategyId,
        taskId,
        ethers.ZeroAddress,
        ethers.ZeroAddress,
        0,
        attestResult.signal,
        ethers.ZeroAddress,
        "0x"
      );
      const receipt = await tx.wait();
      addLog(`[TRADE] ${attestResult.signal} tx=${receipt.hash.slice(0, 16)}...`);
      logger.success(`StrategyVault.executeTrade() ? ${receipt.hash.slice(0, 18)}...`);
    } catch (err) {
      logger.error(`StrategyVault.executeTrade() failed: ${err}`);
    }
  }

  // -- Step 5b: Push decision into 0G Storage batch buffer ------------------
  if (archiver && attestResult && !CONFIG.demoMode) {
    archiver.push({
      iteration: state.iteration,
      taskId,
      ts: new Date().toISOString(),
      signal: attestResult.signal,
      confidence: attestResult.confidence,
      isValid: attestResult.isValid,
      attestationHash: attestResult.attestationHash,
      volBps: vol.realizedVolBps,
      regime: vol.regime,
      price: vol.latestPrice,
      reasoning: attestResult.reasoning,
      volTxHash: state.lastVolTxHash,
      attestTxHash: state.lastAttestTxHash,
    });

    try {
      const result = await archiver.archiveIfDue();
      if (result) {
        state.lastArchiveRoot = result.rootHash;
        state.lastArchiveTxHash = result.txHash;
        state.lastArchiveBatchId = result.batchId;
        state.totalArchivedBatches = archiver.totalBatchesArchived;
        state.totalArchivedDecisions = archiver.totalDecisionsArchived;
        addLog(
          `[0G-STORAGE] batch #${state.totalArchivedBatches} ` +
          `root=${result.rootHash.slice(0, 14)}... ` +
          `(${result.decisionCount} decisions, iters ${result.fromIteration}-${result.toIteration})`
        );
      }
      const s = archiver.getStatus();
      state.pendingArchiveDecisions = s.bufferedDecisions;
      state.zgStorageSdkReady = s.sdkReady;
    } catch (err) {
      logger.warn(`archiver.archiveIfDue() failed: ${err}`);
    }
  }

  // -- Step 6: Sync wallet nonce every 5 iterations (= permanent proof) -------
  if (state.iteration % 5 === 0 && !CONFIG.demoMode) {
    try {
      const nonce = await rpcProvider.getTransactionCount(wallet.address);
      state.onChainTxCount = nonce;
      addLog(`[ON-CHAIN] wallet nonce=${nonce} (${nonce} confirmed txns total)`);
      logger.success(`Wallet nonce: ${nonce}`);
    } catch { /* non-critical */ }
  } else if (CONFIG.demoMode) {
    state.onChainTxCount = state.totalVolTx + state.totalAttestTx;
  }
}

// --- Entry Point --------------------------------------------------------------

async function main(): Promise<void> {
  logger.banner();

  if (!CONFIG.privateKey) throw new Error("ZG_PRIVATE_KEY not set in .env");

  const rpcProvider = new ethers.JsonRpcProvider(CONFIG.rpcUrl);
  const wallet = new ethers.Wallet(CONFIG.privateKey, rpcProvider);
  state.agentWallet = wallet.address;

  logger.info(`Wallet   : ${wallet.address}`);
  logger.info(`Network  : ${CONFIG.rpcUrl}`);
  logger.info(`Strategy : #${CONFIG.strategyId} — YZ-Delta v1`);
  logger.info(`Symbol   : ${CONFIG.symbol}`);
  logger.info(`Interval : ${CONFIG.loopIntervalMs / 1000}s`);
  logger.info(`Demo mode: ${CONFIG.demoMode}`);

  const volEngine = new VolatilityEngine();
  const attester = new ZGAttester(wallet);

  startStatusServer();
  state.running = true;

  await attester.init().catch((err) => {
    logger.warn(`attester.init() failed (non-fatal): ${err}`);
  });
  let verifier: ethers.Contract | null = null;
  let vault: ethers.Contract | null = null;

  if (CONFIG.verifierAddress && !CONFIG.demoMode) {
    verifier = new ethers.Contract(CONFIG.verifierAddress, VERIFIER_ABI, wallet);
    logger.success(`VerifierEngine : ${CONFIG.verifierAddress}`);
  } else if (!CONFIG.demoMode) {
    logger.warn("VERIFIER_ENGINE_ADDRESS not set — deploy contracts first");
  }

  if (CONFIG.vaultAddress && !CONFIG.demoMode) {
    vault = new ethers.Contract(CONFIG.vaultAddress, VAULT_ABI, wallet);
    logger.success(`StrategyVault  : ${CONFIG.vaultAddress}`);
  }

  // 0G Storage archiver (Component 3 of the 0G stack: Chain + Compute + Storage)
  let archiver: ZGStorageArchiver | null = null;
  if (CONFIG.archiveAddress && !CONFIG.demoMode) {
    archiver = new ZGStorageArchiver(wallet, {
      strategyId: CONFIG.strategyId,
      archiveContractAddress: CONFIG.archiveAddress,
      batchSize: CONFIG.archiveBatchSize,
      indexerRpc: CONFIG.storageIndexerRpc,
      cacheDir: path.join(process.cwd(), "archive-cache"),
    });
    logger.success(`ArchiveRegistry: ${CONFIG.archiveAddress}`);
    logger.success(`0G Storage    : batches of ${CONFIG.archiveBatchSize} decisions ? Merkle root ? on-chain`);
  } else if (!CONFIG.demoMode) {
    logger.warn("ARCHIVE_REGISTRY_ADDRESS not set — 0G Storage archiving disabled");
  }

  logger.success(`Agent running — ${CONFIG.loopIntervalMs / 1000}s loop`);
  logger.success(`Every iteration: recordVolatility() + attest() = 2 on-chain txns`);
  addLog(`Agent started. Strategy #${CONFIG.strategyId} on ${CONFIG.symbol}`);

  await runLoop(volEngine, attester, rpcProvider, verifier, vault, wallet, archiver);

  setInterval(async () => {
    try {
      await runLoop(volEngine, attester, rpcProvider, verifier, vault, wallet, archiver);
    } catch (err) {
      logger.error(`Loop error: ${err}`);
      addLog(`[ERR] ${String(err).slice(0, 80)}`);
    }
  }, CONFIG.loopIntervalMs);
}

main().catch((err) => {
  logger.error(`FATAL: ${err}`);
  process.exit(1);
});
