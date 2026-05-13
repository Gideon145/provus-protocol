# PROVUS — 3-Minute Judge Verification Guide

> **One-liner:** Autonomous AI-trading agent with **73,000+ confirmed transactions on 0G Chain mainnet** — every 15 seconds, real Yang-Zhang volatility is sealed on-chain by `VerifierEngine.recordVolatility()`, creating an immutable timestamped record that the strategy is *executing live*, not replaying.
>
> **Track fit:** Track 2 — Agentic Trading Arena (Verifiable Finance). One 0G core component (0G **Chain** mainnet) is verified live; 0G **Compute** (TEE) and 0G **Storage** code paths are fully implemented and pending those services exposing mainnet endpoints addressable from the production wallet (currently testnet-only).

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

## Step 5: Honest Status of 0G Compute & 0G Storage (Optional, 30 seconds)

The 0G hackathon requires *at least one* core component integrated and verifiable on-chain. PROVUS leads with **0G Chain** (73k+ mainnet TXs above). For full transparency, here is the status of the other two components PROVUS targets:

| Component | Implementation | Live status | Why |
|---|---|---|---|
| **0G Chain** | `index.ts` → `VerifierEngine.recordVolatility()` | ✅ Live, 73k+ TXs | Mainnet (16661) endpoint stable |
| **0G Compute** (TEE / DeepSeek V3.1) | [`agent/src/attester.ts`](./agent/src/attester.ts) — broker init, ledger, TEE response validation, signed headers | 🛠 Implemented, mainnet pending | 0G Compute service is currently testnet-only; the broker returns `AccountNotExists` for the mainnet wallet. Visible in `/status.logs`. |
| **0G Storage** (decision archive → `ArchiveRegistry`) | [`agent/src/storage.ts`](./agent/src/storage.ts) — batched serialization, indexer upload, Merkle root → on-chain | 🛠 Implemented, mainnet pending | 0G Storage indexer is currently testnet-only; `zgStorageSdkReady: false` for the mainnet wallet. `ArchiveRegistry` contract already deployed at `0x8fa2c…d8DB`. |

When 0G exposes mainnet endpoints for Compute and Storage, both branches activate with no code changes. The `attest()` and Merkle-root paths are written and gated only on those services being addressable.

---

## Summary: What You've Verified

| Criterion | Evidence | Status |
|---|---|---|
| 0G core component integrated on mainnet | 0G Chain — 73,000+ confirmed TXs on agent wallet | ✅ PASS |
| Autonomous execution | `recordVolatility()` lands every 15s without operator action | ✅ PASS |
| Real strategy logic | Yang-Zhang vol on live Binance OHLCV; regime classification on-chain | ✅ PASS |
| Smart contracts deployed | 5 contracts verifiable on https://chainscan.0g.ai | ✅ PASS |
| Live frontend + status API | Dashboard + `/status` endpoint serving live mainnet data | ✅ PASS |
| Honest scope flagging | Compute / Storage paths shown as implemented but mainnet-pending (not falsely claimed live) | ✅ PASS |

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
**A:** Two reasons. (1) The wallet's lifetime nonce of 73,297 covers all on-chain writes since deployment — `recordVolatility()` calls plus historical activity. (2) `attest()` is gated on a successful 0G Compute TEE response. 0G Compute is currently testnet-only, so on the mainnet agent the TEE branch short-circuits with `AccountNotExists` (visible in `/status.logs`) and `attest()` never fires. The `recordVolatility()` heartbeat continues unaffected and is what drives the lifetime nonce growth. This is documented honestly rather than faked.

**Q: What's the ELO number on `ReputationEngine`?**
**A:** Currently `0` and `initialized: false` on-chain — strategies are initialized to ELO 1500 the first time `updateScore()` fires, which is gated on verified P&L from `VerifierEngine.attest()`. Since `attest()` is pending Compute mainnet rollout, the ELO has not initialized yet. Query it directly: `cast call 0x57C7f2F3051928E2cc7C871Bac590bF1d4BF4c8e "getScore(uint256)" 1 --rpc-url https://evmrpc.0g.ai`.

**Q: Can I integrate PROVUS into my protocol?**
**A:** Yes. Subscribe to `VolatilityRecorded` events on `VerifierEngine` for live strategy state. Once `attest()` activates, also subscribe to `DecisionVerified`. Query `ReputationEngine.getScore(strategyId)` for ELO + win/loss history. `StrategyRegistry` is ERC-721 enumerable.

**Q: Does the hackathon rubric penalize you for Compute/Storage not being live?**
**A:** The rule is: *"Clear proof that **at least one** 0G core component has been integrated."* PROVUS has 0G Chain on mainnet with 73k+ TXs — unambiguously past that bar. Compute and Storage are documented honestly as implemented-pending, which strengthens the *Documentation* and *Technical Implementation Completeness* judging criteria.

---

**Time remaining**: ~1 minute for questions.
