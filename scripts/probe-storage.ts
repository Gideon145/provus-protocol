/**
 * probe-storage.ts
 *
 * PROVUS — Validates 0G Storage round-trip (upload → root hash → retrieve).
 * The rootHash returned here is what gets stored in VerifierEngine.attest().
 *
 * Requires: ZG_PRIVATE_KEY in .env
 * Install:  npm install @0glabs/0g-ts-sdk  (run first if missing)
 * Run:      npx ts-node scripts/probe-storage.ts
 */

import "dotenv/config";
import { ethers } from "ethers";

// 0G Storage endpoints
const INDEXER_RPC = "https://indexer-storage-testnet-turbo.0g.ai";
const FLOW_ADDRESS = "0xbD2C3F0E2984236d0153dc931dA1e40a53Fa7b73"; // 0G Flow contract on testnet

async function main() {
  const pk = process.env.ZG_PRIVATE_KEY;
  if (!pk) throw new Error("ZG_PRIVATE_KEY not set in .env");

  const rpcProvider = new ethers.JsonRpcProvider(
    process.env.ZG_RPC_URL ?? "https://evmrpc-testnet.0g.ai"
  );
  const wallet = new ethers.Wallet(pk, rpcProvider);

  console.log("=".repeat(60));
  console.log("PROVUS — 0G Storage Probe");
  console.log("=".repeat(60));
  console.log("Wallet :", wallet.address);
  console.log();

  // Build a sample reasoning trace (what the agent will upload per decision)
  const trace = {
    version: "1.0",
    strategyId: 1,
    taskId: Date.now(),
    signal: "BUY",
    confidence: 0.82,
    reasoning: "Yang-Zhang vol=42% annualized (MEDIUM regime). DeepSeek recommends BUY on ETH/USD mean reversion.",
    yzVolBps: 4200,
    regime: "MEDIUM",
    price: 1850,
    timestamp: new Date().toISOString(),
    agentWallet: wallet.address,
  };

  const traceJson = JSON.stringify(trace, null, 2);
  console.log("[1] Reasoning trace to upload:");
  console.log(traceJson);
  console.log();

  // Compute the content hash (Merkle root equivalent for single chunk)
  // In real usage: ZgFile.fromBuffer() → file.merkleTree() → tree.rootHash()
  const contentHash = ethers.keccak256(ethers.toUtf8Bytes(traceJson));
  console.log("[2] Content hash (local):", contentHash);
  console.log("    (In production, use ZgFile.merkleTree().rootHash() from @0glabs/0g-ts-sdk)");
  console.log();

  // ─── Real 0G Storage upload (uncomment after: npm install @0glabs/0g-ts-sdk) ───
  //
  // import { ZgFile, Indexer } from "@0glabs/0g-ts-sdk";
  //
  // const indexer = new Indexer(INDEXER_RPC);
  // const file = await ZgFile.fromBuffer(
  //   Buffer.from(traceJson),
  //   "application/json"
  // );
  // const [tree, treeErr] = await file.merkleTree();
  // if (treeErr) throw treeErr;
  // const rootHash = tree!.rootHash();
  // console.log("[3] Merkle root hash:", rootHash);
  //
  // const [txHash, uploadErr] = await indexer.upload(file, FLOW_ADDRESS, rpcProvider, wallet);
  // if (uploadErr) throw uploadErr;
  // console.log("[4] Upload tx hash:", txHash);
  // console.log("    Explorer: https://explorer-testnet.0g.ai/tx/" + txHash);
  //
  // ─────────────────────────────────────────────────────────────────────────────

  // Stub root hash for now (replace with real tree.rootHash() above)
  const storageRoot = contentHash; // same as contentHash for single-file stub
  console.log("[3] Storage root (stub):", storageRoot);
  console.log("    This bytes32 value gets passed to VerifierEngine.attest()");
  console.log();

  console.log("=".repeat(60));
  console.log("INTEGRATION PLAN");
  console.log("=".repeat(60));
  console.log("1. Agent computes signal via 0G Compute (probe-compute.ts)");
  console.log("2. Agent builds reasoning trace JSON");
  console.log("3. Agent uploads trace to 0G Storage → gets rootHash");
  console.log("4. Agent calls VerifierEngine.attest(");
  console.log("     strategyId, taskId, attestationHash, rootHash, signal, confidence, isValid");
  console.log("   )");
  console.log("5. VerifierEngine emits DecisionVerified event on 0G Chain");
  console.log();
  console.log("TODO: npm install @0glabs/0g-ts-sdk  then uncomment the upload block above.");
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
