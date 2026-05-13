# PROVUS — Submission Addendum / Tweet

## Pinned Tweet / Discord follow-up (paste-ready)

```
PROVUS update for @0G_Labs APAC hackathon judges:

✅ 75,000+ TXs on 0G Chain mainnet (autonomous, growing every 15s)
✅ ALL 3 0G components now demonstrably live on testnet:
   • Chain — recordVolatility + attest every 15s
   • Compute — Qwen-2.5-7B via TEE-verified broker
   • Storage — ArchiveRegistry.archiveBatch Merkle root per 50 decisions

Verify in 3 min: github.com/Gideon145/provus-protocol/blob/master/JUDGE_GUIDE.md

Mainnet: chainscan.0g.ai/address/0x94A4365E6B7E79791258A3Fa071824BC2b75a394
Testnet: chainscan-galileo.0g.ai/address/0x94A4365E6B7E79791258A3Fa071824BC2b75a394
```

## Discord/longer-form

```
Quick update on PROVUS (Track 2 — Agentic Trading Arena):

The lifetime mainnet TX count crossed 75,000 today (was 73k at submission).
Same agent, same wallet, still autonomously sealing volatility every 15s.

We also stood up a parallel testnet deployment that exercises all three
0G core components end-to-end, so judges have an answer to "do Compute
and Storage actually work?" — short answer yes, here are the on-chain
proofs:

  Chain (16602)  → recordVolatility + attest landing every 15s
  Compute        → Qwen-2.5-7B inference via dstack-verified provider
                   0xa48f01287233509FD694a22Bf840225062E67836
  Storage        → ArchiveRegistry.archiveBatch() Merkle root every 50
                   iters. Sample TXs: 0xaf325832bd0e17f6,
                   0x570caec7b2b238d0, 0xc04a99133df4e168,
                   0x878bdd96fd9ab333.

The mainnet deployment stays the "this isn't a one-shot demo" anchor;
the testnet deployment is the "we built all three" depth proof.

3-minute judge guide:
https://github.com/Gideon145/provus-protocol/blob/master/JUDGE_GUIDE.md
```
