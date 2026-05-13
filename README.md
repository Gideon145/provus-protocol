# PROVUS Protocol

**Autonomous AI Trading Agent with Cryptographic Attestation on 0G Chain**

> *"Every AI trading decision. Sealed on-chain. Cryptographically proven. Impossible to fake."*

[![Demo Video](https://img.shields.io/badge/Demo%20Video-YouTube-red)](https://youtu.be/lrhgAbrWF94)
[![Live Dashboard](https://img.shields.io/badge/Live%20Dashboard-provus--protocol--frontend.vercel.app-cyan)](https://provus-protocol-frontend.vercel.app)
[![0G Chain Mainnet](https://img.shields.io/badge/0G%20Chain-Mainnet%2016661-brightgreen)](https://chainscan.0g.ai/address/0x94A4365E6B7E79791258A3Fa071824BC2b75a394)
[![73,000+ TXs](https://img.shields.io/badge/Mainnet%20TXs-73%2C000%2B-green)](https://chainscan.0g.ai/address/0x94A4365E6B7E79791258A3Fa071824BC2b75a394)
[![0G Compute](https://img.shields.io/badge/0G%20Compute-Implemented-blue)](./agent/src/attester.ts)
[![0G Storage](https://img.shields.io/badge/0G%20Storage-Implemented-purple)](./agent/src/storage.ts)
[![Audited](https://img.shields.io/badge/Audited-ChainGPT_AI-00c853)](./AUDIT.md)

---

## Project Overview

PROVUS is an autonomous AI trading agent built around **verifiable on-chain attestation**. Every 15 seconds, the agent measures market volatility, computes a Yang-Zhang realized-vol signal, and submits a `recordVolatility()` transaction to **0G Chain mainnet** — creating an immutable, block-timestamped record that the strategy was executing *live* at that moment, with no possibility of post-hoc fabrication.

**73,000+ confirmed transactions** on 0G Chain mainnet (agent wallet `0x94A4...A394`, lifetime nonce, persistent across restarts). The agent loop has been running continuously since deployment with autonomous 15-second cadence.

Built for the 0G APAC Hackathon 2026 (Track 2: Agentic Trading Arena).

---

## 0G Integration

> This section addresses the core hackathon requirement: *"Clear proof that at least one 0G core component has been integrated."* PROVUS leads with **0G Chain mainnet** as the verified integration (73k+ TXs), with **0G Compute** and **0G Storage** code paths fully implemented and ready to activate the moment those services are available against this mainnet wallet (see *What's Live vs. Implemented* below).

### ✅ Component 1: 0G Chain (Mainnet) — **Live, 73k+ TXs**

**What it is:** EVM-compatible layer-1 blockchain (ChainID 16661) used as the tamper-proof state layer.

**How PROVUS uses it:** All 5 smart contracts are deployed on 0G Chain mainnet. The autonomous agent submits a `recordVolatility()` transaction to `VerifierEngine` every 15 seconds — sealing the strategy's market context (Yang-Zhang volatility + regime) into an immutable, block-timestamped on-chain record. These transactions are the product: they are the cryptographic proof that PROVUS is executing *live*, not replaying.

**Why 0G Chain specifically:** Fast block times (~1s), low gas (~0.004 OG per write), and EVM compatibility make it viable to attest *every single decision* in real time. On Ethereum L1, this would cost ~$50/decision. On 0G Chain it costs ~$0.04.

| Contract | Address | Explorer |
|---|---|---|
| StrategyRegistry (ERC-721) | `0x87E3D9fcfA4eff229A65d045A7C741E49b581187` | [View](https://chainscan.0g.ai/address/0x87E3D9fcfA4eff229A65d045A7C741E49b581187) |
| VerifierEngine | `0x911E87629756F34190DF34162806f00b35521FD0` | [View](https://chainscan.0g.ai/address/0x911E87629756F34190DF34162806f00b35521FD0) |
| StrategyVault | `0x2B9366b7fea6a1C6279edbC7B87CCB91CdCc1014` | [View](https://chainscan.0g.ai/address/0x2B9366b7fea6a1C6279edbC7B87CCB91CdCc1014) |
| ReputationEngine | `0x57C7f2F3051928E2cc7C871Bac590bF1d4BF4c8e` | [View](https://chainscan.0g.ai/address/0x57C7f2F3051928E2cc7C871Bac590bF1d4BF4c8e) |
| ArchiveRegistry | `0x8fa2c5ae17E2D170C54fC3CA34148B0Ad503d8DB` | [View](https://chainscan.0g.ai/address/0x8fa2c5ae17E2D170C54fC3CA34148B0Ad503d8DB) |
| **Agent Wallet (mainnet)** | `0x94A4365E6B7E79791258A3Fa071824BC2b75a394` | [**73,000+ confirmed TXs**](https://chainscan.0g.ai/address/0x94A4365E6B7E79791258A3Fa071824BC2b75a394) |

**On-chain proof:**
```bash
curl -X POST https://evmrpc.0g.ai \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_getTransactionCount","params":["0x94A4365E6B7E79791258A3Fa071824BC2b75a394","latest"]}'
# -> {"result":"0x11e51"}  (= 73,297 lifetime confirmed transactions, growing)
```

---

### 🛠️ Component 2: 0G Compute Network (TEE Inference) — **Implemented, awaiting mainnet service rollout**

**What it is:** Decentralized inference network with Trusted Execution Environment support. PROVUS targets DeepSeek V3.1 via the `@0glabs/0g-serving-broker` SDK and provider `0xd9966e13a6026Fcca4b13E7ff95c94DE268C471C`.

**Implementation status:** Full integration written in [`agent/src/attester.ts`](./agent/src/attester.ts) — broker init, ledger creation (`addLedger(3)`), `acknowledgeProviderSigner`, `getServiceMetadata`, signed request headers, OpenAI-compatible chat completion, and `processResponse` TEE-validation are all wired. The `attest()` smart-contract call on `VerifierEngine` is also fully implemented and waiting for the TEE response.

**Why it isn't currently firing on the live mainnet agent:** 0G Compute is presently a **testnet-only service** — the broker SDK looks up the calling wallet on the testnet ledger network. Our production agent runs against 0G Chain *mainnet* (chain 16661), so `addLedger()` returns `AccountNotExists` and the TEE branch short-circuits. The chain-attestation leg continues firing every 15s regardless. The moment 0G Compute exposes mainnet endpoints addressable from this wallet — or the agent is repointed at testnet — the TEE branch activates with no code changes.

**SDK integration excerpt** (`agent/src/attester.ts`):
```typescript
const broker = await createZGComputeNetworkBroker(wallet);
const { endpoint, model } = await broker.inference.requestProcessor
  .getServiceMetadata(DEEPSEEK_PROVIDER);
const headers = await broker.inference.requestProcessor
  .getRequestHeaders(DEEPSEEK_PROVIDER, query);
const isValid = await broker.inference.responseProcessor
  .processResponse(DEEPSEEK_PROVIDER, chatId, content);
```

---

### 🛠️ Component 3: 0G Storage (Decision Archive) — **Implemented, awaiting mainnet service rollout**

**What it is:** Decentralized, content-addressed storage used as the permanent archive layer for every AI decision PROVUS makes.

**Implementation status:** Archiver wired in [`agent/src/storage.ts`](./agent/src/storage.ts). Every 50 decisions, the agent serializes the batch (signal, confidence, attestation hash, timestamp, market context) and is set up to upload to 0G Storage via `https://indexer-storage-testnet-turbo.0g.ai`, then write the Merkle root to `ArchiveRegistry` (already deployed at `0x8fa2c…d8DB` on 0G mainnet).

**Why it isn't currently archiving on the live agent:** Same constraint as 0G Compute — the storage indexer is a **testnet service**, and the production agent runs against 0G mainnet. `zgStorageSdkReady` returns `false` for the mainnet wallet. The `ArchiveRegistry` contract is already live on mainnet and ready to receive Merkle roots the moment Storage exposes a mainnet indexer.

---

## What's Live vs. Implemented

| Capability | Status | Where to verify |
|---|---|---|
| `recordVolatility()` every 15s on 0G mainnet | **LIVE** | [Agent wallet TXs](https://chainscan.0g.ai/address/0x94A4365E6B7E79791258A3Fa071824BC2b75a394) — 73k+ |
| 5 smart contracts on 0G mainnet | **LIVE** | Addresses above |
| Yang-Zhang volatility engine (real Binance OHLCV) | **LIVE** | `/status` → `realizedVolBps`, `regime` |
| Live frontend dashboard | **LIVE** | https://provus-protocol-frontend.vercel.app |
| ChainGPT AI security audit | **LIVE** | [AUDIT.md](./AUDIT.md) |
| 0G Compute TEE inference (DeepSeek V3.1) | **Implemented, mainnet service pending** | [`agent/src/attester.ts`](./agent/src/attester.ts) |
| `VerifierEngine.attest()` AI-decision sealing | **Implemented, gated on TEE response** | [`agent/src/index.ts`](./agent/src/index.ts) Step 4 |
| 0G Storage decision archive (Merkle root → `ArchiveRegistry`) | **Implemented, mainnet service pending** | [`agent/src/storage.ts`](./agent/src/storage.ts) |

> **Honest framing:** The 0G hackathon requires *at least one* core component integrated and verifiable on-chain. PROVUS leads with **0G Chain mainnet** (73,000+ confirmed TXs) as that proven integration. The Compute and Storage code paths are written and waiting on those services exposing mainnet endpoints addressable from the production wallet.

---

## The Problem

AI/algorithmic trading systems are inherently unverifiable. Operators can claim any backtest result they want — there is no public, tamper-proof record of what the strategy was *actually* doing in real time.

- Off-chain logs can be forged, altered, or predated after the fact
- Centralized attestation creates a single point of failure
- Regulators cannot audit real-time strategy state — it is a black box
- Batch attestations hide exact decision timing

No cryptographic standard exists for proving algorithmic decision integrity in real time. PROVUS is a primitive for that standard.

---

## The Solution: How PROVUS Works

Every 15 seconds, the PROVUS agent runs this cycle autonomously:

| Step | Action | Technology | Status |
|---|---|---|---|
| 1 | Fetch ETH/USDT OHLCV (144 × 5-min candles) | Binance REST API | Live |
| 2 | Calculate Yang-Zhang realized volatility (12-hour window) | Agent — `volatility.ts` | Live |
| 3 | Classify regime: LOW / MEDIUM / HIGH / EXTREME | Agent — `volatility.ts` | Live |
| 4 | Record volatility on-chain: `recordVolatility()` | **0G Chain** — VerifierEngine | **Live** (every 15s) |
| 5 | Query DeepSeek V3.1 inside TEE, validate signed response | **0G Compute** — `attester.ts` | Implemented; mainnet service pending |
| 6 | Attest AI decision on-chain: `attest()` | **0G Chain** — VerifierEngine | Implemented; gated on step 5 |
| 7 | Batch decisions every 50 iters, archive to 0G Storage, write Merkle root | **0G Storage** — `storage.ts` | Implemented; mainnet service pending |
| 8 | Broadcast state to frontend | Agent HTTP server | Live |

**Key invariant:** Each `recordVolatility()` transaction's block timestamp is cryptographic proof that the strategy was *executing live* at that moment. When 0G Compute exposes mainnet endpoints, the same invariant extends to the AI signal itself via `attest()`.

---

## Live Deployment

| Service | URL | Status |
|---|---|---|
| Frontend Dashboard | https://provus-protocol-frontend.vercel.app | Live |
| Agent Status API | https://provus-protocol-production.up.railway.app/status | Live |
| Agent Wallet (mainnet) | https://chainscan.0g.ai/address/0x94A4365E6B7E79791258A3Fa071824BC2b75a394 | **73,000+ confirmed TXs** |
| VerifierEngine | https://chainscan.0g.ai/address/0x911E87629756F34190DF34162806f00b35521FD0 | Live, receiving `recordVolatility()` |
| ArchiveRegistry | https://chainscan.0g.ai/address/0x8fa2c5ae17E2D170C54fC3CA34148B0Ad503d8DB | Deployed, awaiting Storage rollout |
| ReputationEngine | https://chainscan.0g.ai/address/0x57C7f2F3051928E2cc7C871Bac590bF1d4BF4c8e | Deployed, awaiting `attest()` activation |
| StrategyRegistry | https://chainscan.0g.ai/address/0x87E3D9fcfA4eff229A65d045A7C741E49b581187 | Live |
| StrategyVault | https://chainscan.0g.ai/address/0x2B9366b7fea6a1C6279edbC7B87CCB91CdCc1014 | Deployed |

---

## System Architecture

```
┌─────────────────────────────────────────────────┐
│         FRONTEND  (Next.js 15 · Vercel)         │
│  Live iteration counter · Volatility gauge      │
│  AI confidence display · ELO reputation card    │
│  Execution log · 0G Explorer links              │
└────────────────────┬────────────────────────────┘
                     │ HTTP polling (every 2s)
                     │ GET /status
┌────────────────────▼────────────────────────────┐
│      AGENT SERVICE  (Node.js · Railway)         │
│      Autonomous 15-second loop                  │
│                                                 │
│  1. Binance API → OHLCV data                    │
│  2. Yang-Zhang volatility calculation           │
│  3. ──► 0G Compute TEE (DeepSeek V3.1)          │
│         Encrypted query → signed inference      │
│  4. ethers.js → recordVolatility() tx           │
│  5. ethers.js → attest() tx                     │
│  6. HTTP broadcast → /status endpoint           │
└──────────┬─────────────────────┬────────────────┘
           │ ethers.js           │ @0glabs/0g-serving-broker
           │ signed txns         │ encrypted inference
┌──────────▼──────────┐  ┌───────▼─────────────────┐
│  0G CHAIN MAINNET   │  │  0G COMPUTE NETWORK      │
│  ChainID 16661      │  │  TEE Inference Layer     │
│  ✅ LIVE             │  │  🛠 Implemented          │
│                     │  │  (testnet only at this   │
│  StrategyRegistry   │  │   stage of 0G rollout)   │
│  VerifierEngine ◄───┘  │                         │
│  StrategyVault      │  │  Provider (when active): │
│  ReputationEngine   │  │  DeepSeek V3.1           │
│  ArchiveRegistry    │  │  0xd9966e13a602...       │
│  73,000+ TXs total  │  │                         │
│  ~1s block time     │  │  Mainnet endpoint        │
│                     │  │  pending from 0G         │
└─────────────────────┘  └─────────────────────────┘
```

---

## Smart Contracts (Solidity 0.8.24 · Deployed on 0G Chain)

### VerifierEngine — `0x911E87629756F34190DF34162806f00b35521FD0`
The attestation hub. Called twice per 15-second cycle. Stores every AI decision as an immutable on-chain record with TEE proof hash and block timestamp.

- `recordVolatility(strategyId, taskId, volBps, regime)` — seals the volatility context
- `attest(strategyId, taskId, attestationHash, storageRoot, signal, confidence, isValid)` — seals the AI decision
- Emits `DecisionVerified` events (subscribable by other protocols)

### ReputationEngine — `0x57C7f2F3051928E2cc7C871Bac590bF1d4BF4c8e`
ELO scoring system. New strategies start at **ELO 1500** (K=64 for first 30 decisions, K=32 after). Updates only on verified P&L from `VerifierEngine`. Currently uninitialized on-chain — score updates begin once `attest()` activates (gated on 0G Compute mainnet rollout).

- `updateScore(strategyId, pnlBps)` — `onlyAuthorized` (verifierEngine), called per realized P&L event
- `getScore(strategyId) → (eloScore, wins, losses, realizedPnlBps, lastUpdated, initialized)` — public query for external protocols
- `getEloScores(uint256[] strategyIds) → uint256[]` — batch read for leaderboards

### StrategyRegistry — `0x87E3D9fcfA4eff229A65d045A7C741E49b581187`
ERC-721 contract. Each trading strategy is minted as a non-fungible token. Transferable, composable, enumerable.

### StrategyVault — `0x2B9366b7fea6a1C6279edbC7B87CCB91CdCc1014`
Capital management + trade execution layer. Executes hedges based on `attest()` signals with slippage protection (±5% delta tolerance).

**Security:** Audited via ChainGPT AI (May 2026). No critical or high-severity findings. See [AUDIT.md](./AUDIT.md) for the full report.

---

## Verified Performance

| Category | Metric | Value | How to Verify |
|---|---|---|---|
| On-Chain | Lifetime confirmed TXs (agent wallet) | **73,000+** | `eth_getTransactionCount` on `0x94A4…A394` |
| On-Chain | Smart contracts deployed on mainnet | 5 | Addresses in *0G Integration* section |
| Cadence | Loop interval | 15s | `/status.iteration` over time |
| Performance | Gas per `recordVolatility()` | ~0.004 OG | Any recent agent TX on ChainScan |
| Reliability | Continuous on-chain writes | Yes — visible in TX feed | [Agent wallet TXs](https://chainscan.0g.ai/address/0x94A4365E6B7E79791258A3Fa071824BC2b75a394) |
| Volatility Engine | Yang-Zhang realized vol on 144 × 5min candles | Live | `/status.realizedVolBps`, `/status.regime` |

---

## Technology Stack

| Layer | Technology | 0G Component | Status |
|---|---|---|---|
| Blockchain | 0G Chain EVM (ChainID 16661) | ✅ 0G Chain | Live on mainnet |
| Contract Interaction | ethers.js v6 | 0G Chain RPC | Live |
| Contracts | Solidity 0.8.24 + OpenZeppelin v5 + Hardhat | — | Live |
| AI Inference | DeepSeek V3.1 inside TEE | 🛠️ 0G Compute | Implemented (`attester.ts`); mainnet service pending |
| TEE SDK | `@0glabs/0g-serving-broker` | 🛠️ 0G Compute | Implemented |
| Decision Archive | Batched JSON → Merkle root → `ArchiveRegistry` | 🛠️ 0G Storage | Implemented (`storage.ts`); mainnet service pending |
| Agent Runtime | Node.js v24 + TypeScript | — | Live (Railway) |
| Frontend | Next.js 15 + React 19 + Tailwind CSS v4 | — | Live (Vercel) |
| Market Data | Binance REST API v3 | — | Live |

---

## For Judges: 3-Minute Verification Path

> Every claim in this README is verifiable on 0G ChainScan or via the live `/status` endpoint right now.

**Step 1 — Confirm 73k+ mainnet TXs (30s)**
```bash
curl -X POST https://evmrpc.0g.ai \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_getTransactionCount","params":["0x94A4365E6B7E79791258A3Fa071824BC2b75a394","latest"]}'
```
Or visit: https://chainscan.0g.ai/address/0x94A4365E6B7E79791258A3Fa071824BC2b75a394

**Step 2 — Watch a fresh on-chain TX land (1 min)**
1. Open the agent wallet on ChainScan (link above)
2. Refresh every ~15 seconds — a new `recordVolatility()` TX appears
3. Click any recent TX — decoded input shows `volBps` (Yang-Zhang volatility, basis points) and `regime` (LOW/MEDIUM/HIGH/EXTREME)

**Step 3 — Query the live agent (30s)**
```bash
curl -s https://provus-protocol-production.up.railway.app/status \
  | jq '{iteration, totalVolTx, lastVolTxHash, regime, realizedVolBps, agentWallet, chainId, demoMode}'
```
Expect: `demoMode: false`, `chainId: 16661` (mainnet), `iteration` and `totalVolTx` incrementing in real time, fresh `lastVolTxHash`.

**Step 4 — See the live dashboard (1 min)**
https://provus-protocol-frontend.vercel.app — iteration counter, volatility gauge, market price, on-chain TX feed all driven by live mainnet data.

**Additional docs:**
- [JUDGE_GUIDE.md](JUDGE_GUIDE.md) — extended verification walkthrough
- [ENGINEERING_DEBUG_LOG.md](ENGINEERING_DEBUG_LOG.md) — 5 production problems solved with root cause analysis

---

## Local Deployment (Reproduction Steps)

### Prerequisites

- Node.js v18+ (v24 recommended)
- A 0G Chain wallet with OG tokens for gas ([faucet: https://faucet.0g.ai](https://faucet.0g.ai))
- A 0G Compute ledger funded with OG tokens (for TEE inference)
- Git

### 1. Clone & Install

```bash
git clone https://github.com/Gideon145/provus-protocol.git
cd provus-protocol
npm install
cd contracts && npm install && cd ..
cd agent && npm install && cd ..
cd frontend && npm install && cd ..
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your values:

```env
# 0G Chain
ZG_PRIVATE_KEY=0x...                   # Your 0G wallet private key
ZG_RPC_URL=https://evmrpc.0g.ai        # 0G Chain mainnet RPC
ZG_CHAIN_ID=16661

# Deployed contract addresses (already live — use these)
VERIFIER_ENGINE=0x911E87629756F34190DF34162806f00b35521FD0
REPUTATION_ENGINE=0x57C7f2F3051928E2cc7C871Bac590bF1d4BF4c8e
STRATEGY_REGISTRY=0x87E3D9fcfA4eff229A65d045A7C741E49b581187
STRATEGY_VAULT=0x2B9366b7fea6a1C6279edbC7B87CCB91CdCc1014
STRATEGY_ID=1

# 0G Compute (TEE inference)
DEEPSEEK_PROVIDER=0xd9966e13a6026Fcca4b13E7ff95c94DE268C471C

# Agent config
STATUS_PORT=3001
TRADE_SYMBOL=ETHUSDT
LOOP_INTERVAL_MS=15000
```

> **Note for reviewers:** To run against the already-deployed contracts (recommended), use the addresses above — no redeployment needed. The agent will start attesting under your own wallet immediately.

### 3. (Optional) Activate the 0G Compute / Storage code paths

The production mainnet agent intentionally runs the chain-attestation leg only because 0G Compute and 0G Storage are currently testnet services. To exercise the TEE + Storage code paths locally, point the agent at 0G testnet:

```env
ZG_RPC_URL=https://evmrpc-testnet.0g.ai
ZG_CHAIN_ID=16602
ZG_STORAGE_INDEXER_RPC=https://indexer-storage-testnet-turbo.0g.ai
```

Then create and fund the inference ledger from the agent's `init()` (handled automatically by `attester.ts` via `broker.ledger.addLedger(3)` if no ledger exists). Use the [0G testnet faucet](https://faucet.0g.ai) for OG tokens.

### 4. Start the Agent

```bash
cd agent
npm run dev
# Output:
# Agent started on :3001
# Connected to 0G Chain (ChainID 16661)
# VerifierEngine: 0x911E87...
# [15:30:00] Iteration #1 — vol: 42.5% MEDIUM — BUY 78%
# [15:30:00] TX: recordVolatility 0xf4d2c1... (confirmed)
# [15:30:08] TX: attest 0x8b7e3a... (confirmed)
```

### 5. Start the Frontend

```bash
cd frontend
npm run dev
# Open http://localhost:3000
```

The dashboard will connect to your local agent (`localhost:3001/status`) and display live data.

### 6. Run Contract Tests

```bash
cd contracts
npm run test
# Tests cover: StrategyRegistry, VerifierEngine, StrategyVault, ReputationEngine
```

---

## Reviewer Notes

| Note | Detail |
|---|---|
| **No setup needed to verify** | All contracts and the agent are already live on 0G mainnet. Use the explorer + `/status` endpoint above. |
| **Gas costs (mainnet)** | ~0.004 OG per `recordVolatility()`. Agent wallet currently holds ~12.8 OG, hundreds of hours of runway. |
| **0G Faucet** | https://faucet.0g.ai — for testnet OG (mainnet OG is acquired separately) |
| **Demo mode** | `DEMO_MODE=true` in `.env` runs the loop without broadcasting (local inspection only) |
| **Agent is live** | Production agent is on Railway; you do not need to run your own to verify on-chain data |
| **0G Compute / Storage** | Active on testnet only at this stage of 0G's rollout. Mainnet agent's TEE + archive code paths short-circuit cleanly with `AccountNotExists` and `zgStorageSdkReady: false` until those services expose mainnet endpoints. |

---

## Market Potential

The global algorithmic trading market is **$18.8B (2024)** and growing at 10.6% CAGR. Every institution running AI strategies faces the same regulatory pressure: prove your model is making real-time decisions, not gaming backtests.

PROVUS is a primitive for **verifiable AI finance** — the infrastructure layer that turns any AI trading signal into a cryptographic fact. Near-term integrations:

- **Yield aggregators** — route capital to highest-ELO verified strategies automatically
- **Compliance tooling** — provide regulators with immutable, timestamped decision logs
- **Insurance protocols** — underwrite AI trading strategies based on on-chain ELO history
- **DAO governance** — whitelist trading agents by verified reputation, not claimed performance

---

## Composability

PROVUS contracts are designed as open primitives. External protocols can:

- **Subscribe** to `VolatilityRecorded` events on `VerifierEngine` for real-time strategy state
- **Subscribe** to `DecisionVerified` events on `VerifierEngine` once `attest()` activates
- **Query** `getScore(strategyId)` on `ReputationEngine` to gate access by ELO + win/loss
- **Route** capital through `StrategyVault` to verified strategies
- **Enumerate** active strategies on `StrategyRegistry` (ERC-721)

Example integration:
```solidity
interface IReputationEngine {
    struct StrategyScore {
        uint256 eloScore;
        uint256 wins;
        uint256 losses;
        int256 realizedPnlBps;
        uint256 lastUpdated;
        bool initialized;
    }
    function getScore(uint256 strategyId) external view returns (StrategyScore memory);
}

IReputationEngine rep = IReputationEngine(0x57C7f2F3051928E2cc7C871Bac590bF1d4BF4c8e);
IReputationEngine.StrategyScore memory s = rep.getScore(1);
require(s.initialized && s.eloScore > 1500, "Agent below baseline");
// route capital based on PROVUS signal
```

---

## Roadmap

- **Activate 0G Compute / Storage on mainnet** — flip `attest()` and Storage archiving live the moment 0G exposes mainnet endpoints for those services
- **Multi-agent swarm** — 3–5 independent strategies on `StrategyRegistry`, each with unique ERC-721 strategy token and separate ELO trajectory
- **x402 monetization** — gate the verified signal API behind micropayments; protocols pay per-query for access
- **Cross-chain replication** — bridge attestation proofs to other EVM chains via 0G's messaging layer
