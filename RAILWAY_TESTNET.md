# Railway Service #2 — Testnet Agent

Use this to stand up a second Railway service that runs the **testnet** PROVUS agent 24/7
in parallel with the existing mainnet service. The mainnet service is untouched.

## Repo / Root

- **GitHub repo:** `Gideon145/provus-protocol` (same as mainnet service)
- **Root Directory:** `agent`
- **Build:** auto-detected (nixpacks Node.js)
- **Start command:** `npx ts-node src/index.ts`

## Environment Variables (paste-ready)

```
ZG_PRIVATE_KEY=62a232ee012e29eada8694487f5640c2ccfac38e1d69ca3f0cc14c799f6909aa
ZG_RPC_URL=https://evmrpc-testnet.0g.ai
ZG_CHAIN_ID=16602
ZG_DEEPSEEK_PROVIDER=0xa48f01287233509FD694a22Bf840225062E67836
ZG_STORAGE_INDEXER_RPC=https://indexer-storage-testnet-turbo.0g.ai
ZG_COMPUTE_LEDGER_OG=3
STRATEGY_REGISTRY_ADDRESS=0x87E3D9fcfA4eff229A65d045A7C741E49b581187
VERIFIER_ENGINE_ADDRESS=0x911E87629756F34190DF34162806f00b35521FD0
STRATEGY_VAULT_ADDRESS=0x2B9366b7fea6a1C6279edbC7B87CCB91CdCc1014
REPUTATION_ENGINE_ADDRESS=0x57C7f2F3051928E2cc7C871Bac590bF1d4BF4c8e
ARCHIVE_REGISTRY_ADDRESS=0x332c763821bb682D46b064AC925535306E1b723a
STRATEGY_ID=1
SYMBOL=ETHUSDT
LOOP_INTERVAL_MS=15000
DEMO_MODE=false
PORT=3002
```

> Note: same agent wallet as mainnet (`0x94A4...A394`). Sub-account on the 0G Compute
> ledger is already funded (~1.1 OG) to provider `0xa48f...7836`.

## After deploy

1. Railway will print the `/status` URL. Verify it returns HTTP 200 with `chainId: 16602`.
2. Check `chainscan-galileo.0g.ai/address/0x94A4365E6B7E79791258A3Fa071824BC2b75a394` —
   `recordVolatility` and `attest` TXs should land every 15s.
3. Every 50 iterations (~12.5 min), `ArchiveRegistry.archiveBatch()` lands a Merkle root TX.

## Cost

- Same Node.js footprint as mainnet service (~30 MB RAM idle, ~50 MB working).
- Network: ~2 TXs / 15s gas paid in test OG (free from 0G faucet).
- Railway hobby plan handles both services on the $5/mo allowance.
