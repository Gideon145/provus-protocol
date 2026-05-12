/**
 * deployArchive.ts
 * PROVUS — Deploy only ArchiveRegistry (the new 0G Storage indexing contract).
 *
 * Existing contracts (StrategyRegistry, VerifierEngine, StrategyVault,
 * ReputationEngine) are NOT touched — they remain at their current mainnet
 * addresses with 60,000+ accumulated transactions.
 *
 * Run: npx tsx scripts/deployArchive.ts
 */

import { ethers } from "ethers";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

dotenv.config({ path: path.join(__dirname, "../../.env") });

const RPC_URL = process.env.ZG_RPC_URL ?? "https://evmrpc.0g.ai";
const PRIVATE_KEY = process.env.ZG_PRIVATE_KEY!;
const AGENT_WALLET = process.env.AGENT_WALLET ?? ""; // optional: pre-authorize agent wallet

if (!PRIVATE_KEY) throw new Error("ZG_PRIVATE_KEY not set in .env");

const ArchiveArtifact = require("../artifacts/contracts/ArchiveRegistry.sol/ArchiveRegistry.json");

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const network = await provider.getNetwork();

  console.log("=".repeat(60));
  console.log("PROVUS — ArchiveRegistry Deployment");
  console.log("=".repeat(60));
  console.log("Deployer :", wallet.address);
  console.log("RPC      :", RPC_URL);
  console.log("Chain ID :", network.chainId.toString());
  console.log("Balance  :", ethers.formatEther(await provider.getBalance(wallet.address)), "OG");
  console.log();

  console.log("[1/2] Deploying ArchiveRegistry...");
  const Archive = new ethers.ContractFactory(
    ArchiveArtifact.abi,
    ArchiveArtifact.bytecode,
    wallet
  );
  const archive = await Archive.deploy();
  await archive.waitForDeployment();
  const archiveAddr = await archive.getAddress();
  console.log("      ArchiveRegistry:", archiveAddr);

  // Optional: authorize the live agent wallet so it can call archiveBatch().
  if (AGENT_WALLET && AGENT_WALLET.toLowerCase() !== wallet.address.toLowerCase()) {
    console.log("[2/2] Authorizing agent wallet:", AGENT_WALLET);
    const tx = await (archive as any).setAuthorized(AGENT_WALLET, true);
    await tx.wait();
    console.log("      Authorized ✓");
  } else {
    console.log("[2/2] Deployer is also the agent — no extra authorization needed");
  }

  // Update deployments.json (keep existing entries, add ArchiveRegistry)
  const deployPath = path.join(__dirname, "..", "deployments.json");
  let deployments: any = {};
  if (fs.existsSync(deployPath)) {
    deployments = JSON.parse(fs.readFileSync(deployPath, "utf8"));
  }
  deployments.contracts = deployments.contracts ?? {};
  deployments.contracts.ArchiveRegistry = archiveAddr;
  deployments.archiveDeployedAt = new Date().toISOString();
  fs.writeFileSync(deployPath, JSON.stringify(deployments, null, 2));
  console.log();
  console.log("deployments.json updated.");

  console.log();
  console.log("=".repeat(60));
  console.log("ARCHIVE REGISTRY DEPLOYED");
  console.log("=".repeat(60));
  console.log("Address  :", archiveAddr);
  console.log("Explorer : https://chainscan.0g.ai/address/" + archiveAddr);
  console.log();
  console.log("Add to .env:");
  console.log("  ARCHIVE_REGISTRY_ADDRESS=" + archiveAddr);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
