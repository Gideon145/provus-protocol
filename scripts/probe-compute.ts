/**
 * probe-compute.ts
 *
 * PROVUS critical-path validator: proves that 0G Compute TEE attestation
 * (processResponse → isValid) works end-to-end before we build anything else.
 *
 * Run: npx ts-node scripts/probe-compute.ts
 * Requires: ZG_PRIVATE_KEY in .env (wallet must have OG testnet tokens)
 */

import "dotenv/config";
import { createZGComputeNetworkBroker } from "@0glabs/0g-serving-broker";
import { ethers } from "ethers";
import OpenAI from "openai";

// ─── Config ───────────────────────────────────────────────────────────────────

const PROVIDER = process.env.ZG_DEEPSEEK_PROVIDER ?? "0xd9966e13a6026Fcca4b13E7ff95c94DE268C471C";
const RPC_URL = process.env.ZG_RPC_URL ?? "https://evmrpc-testnet.0g.ai";

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const pk = process.env.ZG_PRIVATE_KEY;
  if (!pk) throw new Error("ZG_PRIVATE_KEY not set in .env");

  const rpcProvider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(pk, rpcProvider);

  console.log("=".repeat(60));
  console.log("PROVUS — 0G Compute Probe");
  console.log("=".repeat(60));
  console.log("Wallet  :", wallet.address);
  console.log("RPC     :", RPC_URL);
  console.log("Provider:", PROVIDER);
  console.log();

  // Step 1: Create broker
  console.log("[1/7] Creating ZGComputeNetworkBroker...");
  const broker = await createZGComputeNetworkBroker(wallet);
  console.log("      OK");

  // Step 2: Ensure ledger exists
  console.log("[2/7] Checking ledger...");
  try {
    const ledger = await broker.ledger.getLedger();
    console.log("      Ledger exists:", JSON.stringify(ledger));
  } catch {
    console.log("      No ledger found — creating with 3 OG...");
    await broker.ledger.addLedger(3);
    console.log("      Ledger created.");
  }

  // Step 3: Acknowledge provider signer (needed before first request)
  console.log("[3/7] Acknowledging provider signer...");
  try {
    await broker.inference.acknowledgeProviderSigner(PROVIDER);
    console.log("      OK");
  } catch (err) {
    console.log("      Skipped (may not be needed):", String(err).slice(0, 80));
  }

  // Step 4: Get service metadata
  console.log("[4/7] Getting service metadata...");
  const { endpoint, model } = await broker.inference.requestProcessor.getServiceMetadata(PROVIDER);
  console.log("      endpoint:", endpoint);
  console.log("      model   :", model);

  // Step 5: Build request headers (includes TEE proof request)
  const query =
    "Analyze ETH/USD: price=1850 USD, 24h_change=-2.1%, realized_vol_annualized=42%. " +
    'Respond with JSON only: {"signal":"BUY"|"SELL"|"HOLD","confidence":0.0-1.0,"reasoning":"string"}';

  console.log("[5/7] Getting request headers...");
  const headers = await broker.inference.requestProcessor.getRequestHeaders(PROVIDER, query);
  console.log("      headers keys:", Object.keys(headers));

  // Step 6: Call DeepSeek via OpenAI-compatible API
  console.log("[6/7] Calling AI model...");
  const openai = new OpenAI({
    baseURL: endpoint,
    apiKey: "",
    defaultHeaders: headers as unknown as Record<string, string>,
  });

  const response = await openai.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content: "You are a DeFi trading signal generator. Respond with valid JSON only.",
      },
      { role: "user", content: query },
    ],
  });

  const content = response.choices[0].message.content ?? "{}";
  const chatId = response.id;
  console.log("      chatId  :", chatId);
  console.log("      response:", content);

  // Step 7: Verify TEE attestation — THE CORE PROVUS PROOF
  console.log("[7/7] Verifying TEE attestation (processResponse)...");
  const isValid = await broker.inference.responseProcessor.processResponse(PROVIDER, chatId, content);

  console.log();
  console.log("=".repeat(60));
  console.log("TEE ATTESTATION RESULT");
  console.log("=".repeat(60));
  console.log("isValid:", isValid);

  if (isValid === true) {
    console.log("✓ PROVUS CORE VALIDATED — 0G TEE proof confirmed.");
    console.log("  This flag will be stored in VerifierEngine.attest() on-chain.");
  } else if (isValid === null) {
    console.log("⚠ null — provider may not support TEE in this region/model.");
  } else {
    console.log("✗ isValid=false — attestation failed. Check wallet balance / provider.");
  }

  // Build the on-chain attestation hash
  const attestationHash = ethers.keccak256(
    ethers.toUtf8Bytes(JSON.stringify({ chatId, content, isValid, provider: PROVIDER }))
  );

  // Placeholder storage root (replace with real 0G Storage upload later)
  const storageRoot = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify({ chatId, timestamp: Date.now() })));

  console.log();
  console.log("─── On-chain data for VerifierEngine.attest() ───");
  console.log("attestationHash:", attestationHash);
  console.log("storageRoot    :", storageRoot, "(stub — see probe-storage.ts)");
  console.log("signal         :", parseSignal(content).signal);
  console.log("confidence     :", parseSignal(content).confidence);
  console.log();
}

function parseSignal(json: string): { signal: string; confidence: number } {
  try {
    const p = JSON.parse(json);
    return { signal: p.signal ?? "HOLD", confidence: Number(p.confidence ?? 0.5) };
  } catch {
    return { signal: "HOLD", confidence: 0.5 };
  }
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
