import "@nomicfoundation/hardhat-ethers";
import "dotenv/config";

const PRIVATE_KEY = process.env.ZG_PRIVATE_KEY ?? "0x" + "0".repeat(64);

export default {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "cancun", // safe choice for 0G Chain testnet
    },
  },
  networks: {
    // 0G Testnet (ChainID: 16602)
    zg_testnet: {
      type: "http",
      url: process.env.ZG_RPC_URL ?? "https://evmrpc-testnet.0g.ai",
      chainId: 16602,
      accounts: [PRIVATE_KEY],
    },
    // 0G Mainnet (ChainID: 16661)
    zg_mainnet: {
      type: "http",
      url: "https://evmrpc.0g.ai",
      chainId: 16661,
      accounts: [PRIVATE_KEY],
    },
  },
  paths: {
    sources: "./contracts",
    scripts: "./scripts",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};
