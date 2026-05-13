/**
 * deploy.ts
 * PROVUS — Deploy all 4 contracts to 0G Chain in sequence.
 *
 * Uses ethers.js directly (bypasses hre.ethers which is broken in Hardhat 3 + hardhat-ethers v4).
 * Reads compiled artifacts from artifacts/contracts/
 *
 * Run: npm run deploy:mainnet
 */

import { ethers } from "ethers";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// Allow override: `ENV_FILE=.env.testnet npm run deploy:testnet`
const envFile = process.env.ENV_FILE ?? "../../.env";
const envPath = path.isAbsolute(envFile) ? envFile : path.join(__dirname, envFile);
dotenv.config({ path: envPath });
console.log(`[env] loaded ${envPath}`);

const RPC_URL = process.env.ZG_RPC_URL ?? "https://evmrpc.0g.ai";
const PRIVATE_KEY = process.env.ZG_PRIVATE_KEY!;

if (!PRIVATE_KEY) throw new Error("ZG_PRIVATE_KEY not set in .env");

// Load compiled artifacts
const RegistryArtifact   = require("../artifacts/contracts/StrategyRegistry.sol/StrategyRegistry.json");
const ReputationArtifact = require("../artifacts/contracts/ReputationEngine.sol/ReputationEngine.json");
const VerifierArtifact   = require("../artifacts/contracts/VerifierEngine.sol/VerifierEngine.json");
const VaultArtifact      = require("../artifacts/contracts/StrategyVault.sol/StrategyVault.json");

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet   = new ethers.Wallet(PRIVATE_KEY, provider);
  const network  = await provider.getNetwork();

  console.log("=".repeat(60));
  console.log("PROVUS — Contract Deployment");
  console.log("=".repeat(60));
  console.log("Deployer :", wallet.address);
  console.log("RPC      :", RPC_URL);
  console.log("Chain ID :", network.chainId.toString());
  console.log("Balance  :", ethers.formatEther(await provider.getBalance(wallet.address)), "OG");
  console.log();

  // 1. Deploy StrategyRegistry
  console.log("[1/4] Deploying StrategyRegistry...");
  const Registry = new ethers.ContractFactory(RegistryArtifact.abi, RegistryArtifact.bytecode, wallet);
  const registry = await Registry.deploy();
  await registry.waitForDeployment();
  const registryAddr = await registry.getAddress();
  console.log("      StrategyRegistry:", registryAddr);

  // 2. Deploy ReputationEngine
  console.log("[2/4] Deploying ReputationEngine...");
  const Reputation = new ethers.ContractFactory(ReputationArtifact.abi, ReputationArtifact.bytecode, wallet);
  const reputation = await Reputation.deploy();
  await reputation.waitForDeployment();
  const reputationAddr = await reputation.getAddress();
  console.log("      ReputationEngine:", reputationAddr);

  // 3. Deploy VerifierEngine (needs StrategyRegistry address)
  console.log("[3/4] Deploying VerifierEngine...");
  const Verifier = new ethers.ContractFactory(VerifierArtifact.abi, VerifierArtifact.bytecode, wallet);
  const verifier = await Verifier.deploy(registryAddr);
  await verifier.waitForDeployment();
  const verifierAddr = await verifier.getAddress();
  console.log("      VerifierEngine:", verifierAddr);

  // 4. Deploy StrategyVault
  console.log("[4/4] Deploying StrategyVault...");
  const Vault = new ethers.ContractFactory(VaultArtifact.abi, VaultArtifact.bytecode, wallet);
  const vault = await Vault.deploy();
  await vault.waitForDeployment();
  const vaultAddr = await vault.getAddress();
  console.log("      StrategyVault:", vaultAddr);

  // 5. Wire up references
  console.log();
  console.log("[5/5] Wiring up contract references...");

  const ve1 = await registry.setVerifierEngine(verifierAddr);
  await ve1.wait();
  console.log("      registry.setVerifierEngine ✓");

  const ve2 = await reputation.setVerifierEngine(verifierAddr);
  await ve2.wait();
  console.log("      reputation.setVerifierEngine ✓");

  const ve3 = await vault.setVerifierEngine(verifierAddr);
  await ve3.wait();
  console.log("      vault.setVerifierEngine ✓");

  const rep = await verifier.setReputation(reputationAddr);
  await rep.wait();
  console.log("      verifier.setReputation ✓");

  // 6. Save deployment addresses
  const deployments = {
    network: RPC_URL.includes("testnet") ? "zg_testnet" : "zg_mainnet",
    chainId: network.chainId.toString(),
    deployer: wallet.address,
    deployedAt: new Date().toISOString(),
    contracts: {
      StrategyRegistry: registryAddr,
      VerifierEngine: verifierAddr,
      StrategyVault: vaultAddr,
      ReputationEngine: reputationAddr,
    },
  };

  const deployDir = path.join(__dirname, "..");
  // Network-suffixed file (so testnet deploy doesn't overwrite mainnet record)
  const suffix = deployments.network === "zg_testnet" ? "-testnet" : "-mainnet";
  const networkFile = `deployments${suffix}.json`;
  fs.writeFileSync(
    path.join(deployDir, networkFile),
    JSON.stringify(deployments, null, 2)
  );
  // Also overwrite the canonical deployments.json for backwards compatibility
  fs.writeFileSync(
    path.join(deployDir, "deployments.json"),
    JSON.stringify(deployments, null, 2)
  );
  console.log();
  console.log(`Deployments saved to ${networkFile} and deployments.json`);

  // 7. Print summary
  console.log();
  console.log("=".repeat(60));
  console.log("DEPLOYMENT COMPLETE");
  console.log("=".repeat(60));
  console.log("StrategyRegistry :", registryAddr);
  console.log("VerifierEngine   :", verifierAddr);
  console.log("StrategyVault    :", vaultAddr);
  console.log("ReputationEngine :", reputationAddr);
  console.log();
  console.log("Next steps:");
  console.log("  1. Update .env with contract addresses");
  console.log("  2. Run: npx ts-node scripts/probe-compute.ts");
  console.log("  3. Run: npx ts-node agent/src/index.ts");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
