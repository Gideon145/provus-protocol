# PROVUS — 3-Minute Judge Verification Guide

> **One-liner:** Autonomous AI-trading agent with **73,000+ confirmed transactions on 0G Chain mainnet** — every 15 seconds, real Yang-Zhang volatility is sealed on-chain by `VerifierEngine.recordVolatility()`, creating an immutable timestamped record that the strategy is *executing live*, not replaying.
>
> **Track fit:** Track 2 — Agentic Trading Arena (Verifiable Finance).
>
> **PROVUS ships in two coordinated deployments:**
>
> | Deployment | Chain ID | Components Live | Strongest Evidence |
> |---|---|---|---|
> | **Mainnet (primary)** | 16661 | 0G **Chain** | 73,000+ confirmed TXs on agent wallet — irrefutable proof of long-running autonomous operation |
> | **Testnet (full stack)** | 16602 | 0G **Chain** + **Compute** + **Storage** | All three 0G components exercised end-to-end. Real Qwen-2.5-7B inference via 0G Compute broker, `VerifierEngine.attest()` landing every 15s, `ArchiveRegistry.archiveBatch()` writing a Merkle root every 50 decisions |
>
> The mainnet deployment carries the lifetime-TX-count claim. The testnet deployment proves the *full* PROVUS pipeline (Chain + Compute + Storage) works end-to-end against live 0G infrastructure. Same wallet, same code, two networks — switched by environment variable.

**Objective**: Verify a live, autonomous strategy attestation pipeline running on 0G Chain mainnet.
**Time**: ~3 minutes
**Live Dashboard**: https://provus-protocol-frontend.vercel.app
**Agent Status**: https://provus-protocol-production.up.railway.app/status
**Explorer**: https://chainscan.0g.ai

---

## Step 1: Confirm 73k+ mainnet TXs (30 seconds)

```bash
curl -s -X POST https://evmrpc.0g.ai \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_getTransactionCount","params":["0x94A4365E6B7E79791258A3Fa071824BC2b75a394","latest"]}'
```

Or open: https://chainscan.0g.ai/address/0x94A4365E6B7E79791258A3Fa071824BC2b75a394

**What this proves:**
- ✅ Lifetime confirmed transactions on 0G mainnet by the agent wallet (currently 73,000+ and counting)
- ✅ Wallet nonce is read directly from the chain — cannot be fabricated
- ✅ Counter persists across agent restarts (proof of long-running autonomous operation)

---

## Step 2: Watch a Fresh `recordVolatility()` TX Land (1 minute)

Open the agent wallet on ChainScan (link above). Refresh every ~15 seconds — a new transaction appears each cycle. Click any recent TX:

- **Method**: `recordVolatility(uint256,uint256,uint256,string)`
- **To**: `0x911E87629756F34190DF34162806f00b35521FD0` (`VerifierEngine`)
- **Decoded input**: `strategyId`, `taskId`, `volBps` (Yang-Zhang realized volatility, basis points), `regime` (LOW / MEDIUM / HIGH / EXTREME)
- **Block timestamp**: exact moment the strategy state was sealed on-chain

**What this proves:**
- ✅ The agent is autonomous — fresh TXs land every 15s without operator action
- ✅ Volatility is computed on real Binance OHLCV (not random) and committed before the next cycle
- ✅ Block timestamp is a tamper-proof record of *when* the strategy was running

---

## Step 3: Query the Live Agent (30 seconds)

```bash
curl -s https://provus-protocol-production.up.railway.app/status \
  | jq '{iteration, totalVolTx, lastVolTxHash, regime, realizedVolBps, agentWallet, chainId, demoMode}'
```

**Expected:**
```json
{
  "iteration": 3403,
  "totalVolTx": 3401,
  "lastVolTxHash": "0x0ed2d2b4e2cbe328764710a60b1b916e1bfccc13ce724018d7f635f2dfc3b06b",
  "regime": "MEDIUM",
  "realizedVolBps": 4330,
  "agentWallet": "0x94A4365E6B7E79791258A3Fa071824BC2b75a394",
  "chainId": 16661,
  "demoMode": false
}
```

**What this proves:**
- ✅ `demoMode: false` — agent is broadcasting real mainnet transactions
- ✅ `chainId: 16661` — 0G mainnet
- ✅ `iteration` and `totalVolTx` increment over time (refresh after 15s)
- ✅ `lastVolTxHash` resolves on https://chainscan.0g.ai

---

## Step 4: Live Dashboard (30 seconds)

Visit: https://provus-protocol-frontend.vercel.app

- Iteration counter increments every 15s
- Volatility gauge updates from live `realizedVolBps`
- Market price feed (ETH/USD) live
- On-chain TX hash badge updates each cycle and links to ChainScan

---

## Step 5: Verify All Three 0G Components on Testnet (1 minute)

The 0G hackathon requires *at least one* core component integrated and verifiable on-chain. PROVUS leads with **0G Chain mainnet** (73k+ TXs above) and also runs a **parallel testnet deployment that exercises all three components end-to-end**.

### Testnet Contract Addresses (Chain ID 16602)

| Contract | Address |
|---|---|
| `StrategyRegistry` | `0x87E3D9fcfA4eff229A65d045A7C741E49b581187` |
| `VerifierEngine` | `0x911E87629756F34190DF34162806f00b35521FD0` |
| `StrategyVault` | `0x2B9366b7fea6a1C6279edbC7B87CCB91CdCc1014` |
| `ReputationEngine` | `0x57C7f2F3051928E2cc7C871Bac590bF1d4BF4c8e` |
| `ArchiveRegistry` | `0x332c763821bb682D46b064AC925535306E1b723a` |

Explorer: https://chainscan-galileo.0g.ai/address/0x94A4365E6B7E79791258A3Fa071824BC2b75a394

### Component Status

| Component | Implementation | Mainnet (16661) | Testnet (16602) |
|---|---|---|---|
| **0G Chain** | `index.ts` → `VerifierEngine.recordVolatility()` + `attest()` | ✅ 73,000+ confirmed TXs | ✅ Both methods landing every 15s. Sample: vol `0xd3a019cb52d26479`, attest `0xb6a46c099947734e` |
| **0G Compute** (TEE) | [`agent/src/attester.ts`](./agent/src/attester.ts) — broker init, sub-account funding, OpenAI-compatible chat | 🛠 Service not yet on mainnet | ✅ Live. Qwen-2.5-7B inference via dstack-verified provider `0xa48f01287233509FD694a22Bf840225062E67836`. Sample chat ids: `chatcmpl-5884c4f`, `chatcmpl-e1f51ee`. TEE signer `0x83df4B8EbA7c0B3B740019b8c9a77ffF77D508cF` acknowledged on-chain. |
| **0G Storage** (decision archive → `ArchiveRegistry`) | [`agent/src/storage.ts`](./agent/src/storage.ts) — batched serialization, deterministic keccak Merkle root, indexer upload | 🛠 Service not yet on mainnet | ✅ `ArchiveRegistry.archiveBatch()` lands every 50 decisions with the Merkle root on-chain. Verified TXs: `0xaf325832bd0e17f6` (iteration 51), `0x570caec7b2b238d0` (iteration 102). Indexer `https://indexer-storage-testnet-turbo.0g.ai` returns live storage nodes (`34.83.53.209:5678`, `34.169.28.106:5678`). |

### Verifying Testnet Activity Yourself

```bash
# Recent recordVolatility / attest TXs (testnet)
curl -X POST https://evmrpc-testnet.0g.ai \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_getTransactionCount","params":["0x94A4365E6B7E79791258A3Fa071824BC2b75a394","latest"]}'

# ArchiveRegistry batches written
curl -X POST https://evmrpc-testnet.0g.ai \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_getTransactionByHash","params":["0xaf325832bd0e17f6..."]}'
```

When 0G Compute and Storage services expose mainnet endpoints, the same code points at chain 16661 and the testnet evidence above migrates one-for-one — no code changes required, only `ZG_RPC_URL` / `ZG_CHAIN_ID`.

---

## Summary: What You've Verified

| Criterion | Evidence | Status |
|---|---|---|
| 0G core component integrated on mainnet | 0G Chain — 73,000+ confirmed TXs on agent wallet | ✅ PASS |
| **All three 0G components integrated** | Testnet (16602): Chain + Compute (Qwen-2.5-7B TEE) + Storage (`ArchiveRegistry.archiveBatch` Merkle root) all live | ✅ PASS |
| Autonomous execution | `recordVolatility()` + `attest()` lands every 15s without operator action | ✅ PASS |
| Real strategy logic | Yang-Zhang vol on live Binance OHLCV; regime classification on-chain | ✅ PASS |
| Smart contracts deployed | 5 contracts on mainnet + 5 contracts on testnet, all verifiable | ✅ PASS |
| Live frontend + status API | Dashboard + `/status` endpoint serving live mainnet data | ✅ PASS |
| Honest scope flagging | Each network's component status reported precisely, not conflated | ✅ PASS |

---

## Additional Resources

- **GitHub**: https://github.com/Gideon145/provus-protocol
- **README**: full architecture, contracts, and roadmap
- **Engineering Debug Log**: `ENGINEERING_DEBUG_LOG.md` (real production problems solved)
- **Contract source**: `contracts/contracts/` (5 Solidity files)
- **Agent loop**: `agent/src/index.ts` (15s cadence)
- **TEE attester**: `agent/src/attester.ts` (0G Compute integration)
- **Storage archiver**: `agent/src/storage.ts` (0G Storage integration)

---

## Questions Judges May Ask

**Q: Why is `totalAttestTx` 0 in `/status` but you have 73k+ TXs on the wallet?**
**A:** `/status` reflects the *mainnet* agent. On mainnet, `attest()` is gated on a successful 0G Compute TEE response, and 0G Compute is not yet on mainnet — so the TEE branch short-circuits and `attest()` does not fire on mainnet. The `recordVolatility()` heartbeat continues unaffected, which drives the 73k+ lifetime nonce. **On testnet (chain 16602), `attest()` does fire every 15s** — see the testnet TX list in Step 5. Same wallet, two networks: mainnet anchors the long-running autonomy claim, testnet proves the full pipeline.

**Q: What's the ELO number on `ReputationEngine`?**
**A:** ELO updates are gated on `attest(isValid=true)`. On testnet, the TEE signature step from the current Qwen provider currently produces `isValid=null` (the attestation is *recorded on-chain* but cannot be marked verified) — we degrade gracefully rather than crash. As soon as a TEE-clean provider is online, `isValid=true` flows in and ELO initializes at 1500. Query directly: `cast call 0x57C7f2F3051928E2cc7C871Bac590bF1d4BF4c8e "getScore(uint256)" 1 --rpc-url https://evmrpc-testnet.0g.ai`.

**Q: Can I integrate PROVUS into my protocol?**
**A:** Yes. Subscribe to `VolatilityRecorded` events on `VerifierEngine` for live strategy state. Once `attest()` activates, also subscribe to `DecisionVerified`. Query `ReputationEngine.getScore(strategyId)` for ELO + win/loss history. `StrategyRegistry` is ERC-721 enumerable.

**Q: Does the hackathon rubric penalize you for Compute/Storage not being live on mainnet?**
**A:** The rule is: *"Clear proof that **at least one** 0G core component has been integrated."* PROVUS has 0G Chain on mainnet with 73k+ TXs — unambiguously past that bar. We *additionally* run a parallel testnet deployment that exercises **all three** components live (see Step 5), so the "Technical Implementation Completeness" and "0G Integration Depth" criteria are over-served, not under-served.

---

**Time remaining**: ~1 minute for questions.
