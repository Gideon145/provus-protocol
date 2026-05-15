"use client";

/**
 * /judge — Read-only hackathon review surface.
 *
 * No wallet required. Auto-loads the latest agent /status, surfaces the live
 * lifetime nonce, contract addresses, mainnet/testnet split, and explorer
 * links — all on one page so a judge can verify PROVUS in under a minute.
 */

import { useEffect, useState } from "react";

/* ---- Constants ------------------------------------------------------------ */
const AGENT_WALLET = "0x94A4365E6B7E79791258A3Fa071824BC2b75a394";
const RPC_MAINNET  = "https://evmrpc.0g.ai";
const EXPLORER     = "https://chainscan.0g.ai";
const EXPLORER_T   = "https://chainscan-galileo.0g.ai";
const STATUS_URL   = "/api/agent";

const CONTRACTS = [
  { name: "StrategyRegistry (ERC-721)", addr: "0x87E3D9fcfA4eff229A65d045A7C741E49b581187" },
  { name: "VerifierEngine",             addr: "0x911E87629756F34190DF34162806f00b35521FD0" },
  { name: "StrategyVault",              addr: "0x2B9366b7fea6a1C6279edbC7B87CCB91CdCc1014" },
  { name: "ReputationEngine",           addr: "0x57C7f2F3051928E2cc7C871Bac590bF1d4BF4c8e" },
  { name: "ArchiveRegistry",            addr: "0x8fa2c5ae17E2D170C54fC3CA34148B0Ad503d8DB" },
];

interface AgentStatus {
  iteration?: number;
  totalVolTx?: number;
  lastVolTxHash?: string;
  regime?: string;
  realizedVolBps?: number;
  agentWallet?: string;
  chainId?: number;
  demoMode?: boolean;
  computeStatus?: string;
  computeStatusNote?: string;
  loopIntervalMs?: number;
}

/* ---- Helpers -------------------------------------------------------------- */
async function fetchLifetimeNonce(): Promise<number | null> {
  try {
    const res = await fetch(RPC_MAINNET, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_getTransactionCount",
        params: [AGENT_WALLET, "latest"],
      }),
    });
    const data = await res.json();
    return parseInt(data.result, 16);
  } catch {
    return null;
  }
}

/* ---- Page ----------------------------------------------------------------- */
export default function JudgePage() {
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [nonce, setNonce] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [s, n] = await Promise.allSettled([
        fetch(STATUS_URL).then((r) => r.json()),
        fetchLifetimeNonce(),
      ]);
      if (s.status === "fulfilled") setStatus(s.value);
      if (n.status === "fulfilled") setNonce(n.value);
      setLoading(false);
    };
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <main className="min-h-screen hud-grid scanlines" style={{ padding: "2rem 1rem" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        {/* --------- Header --------- */}
        <header style={{ marginBottom: "2rem", borderBottom: "1px solid var(--border-glow)", paddingBottom: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
            <div>
              <div style={{ fontSize: "1.1rem", color: "var(--cyan)", letterSpacing: "0.2em", marginBottom: "0.25rem" }}>
                ⬢ JUDGE MODE — 0G APAC HACKATHON
              </div>
              <h1 style={{ fontFamily: "var(--font-orbitron), sans-serif", fontSize: "3rem", margin: 0, color: "var(--text-primary)" }}>
                PROVUS Protocol
              </h1>
              <div style={{ color: "var(--text-dim)", fontSize: "1.25rem", marginTop: "0.25rem" }}>
                Verifiable Signal Engine · Read-only review · No wallet required
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <a href="/" style={linkBtn}>← Live Dashboard</a>
            </div>
          </div>
        </header>

        {/* --------- The headline number --------- */}
        <section className="card-hud" style={cardLg}>
          <div style={{ fontSize: "1rem", color: "var(--text-dim)", letterSpacing: "0.2em" }}>
            LIFETIME MAINNET TRANSACTIONS · agent wallet · live from 0G RPC
          </div>
          <div style={{ fontFamily: "var(--font-orbitron)", fontSize: "6rem", color: "var(--green)", lineHeight: 1, marginTop: "0.5rem" }} className="text-glow-green">
            {nonce !== null ? nonce.toLocaleString() : loading ? "…" : "—"}
          </div>
          <div style={{ color: "var(--text-dim)", fontSize: "1.2rem", marginTop: "0.5rem" }}>
            Read directly from <code>eth_getTransactionCount</code> on{" "}
            <a href={`${EXPLORER}/address/${AGENT_WALLET}`} target="_blank" rel="noreferrer" style={inlineLink}>
              {AGENT_WALLET.slice(0, 10)}…{AGENT_WALLET.slice(-6)}
            </a>{" "}
            — cannot be fabricated. Refreshes every 60s.
          </div>
          <div style={{ marginTop: "1rem", display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <a href={`${EXPLORER}/address/${AGENT_WALLET}`} target="_blank" rel="noreferrer" style={btnPrimary}>
              Open Agent Wallet on ChainScan ↗
            </a>
            {status?.lastVolTxHash && (
              <a href={`${EXPLORER}/tx/${status.lastVolTxHash}`} target="_blank" rel="noreferrer" style={btnSecondary}>
                Latest TX: {status.lastVolTxHash.slice(0, 12)}… ↗
              </a>
            )}
          </div>
        </section>

        {/* --------- Live agent status --------- */}
        <section className="card-hud" style={card}>
          <h2 style={h2}>Live Agent Status</h2>
          <div style={grid}>
            <Stat label="Iteration"        value={status?.iteration?.toLocaleString() ?? "—"} />
            <Stat label="Total Vol TXs"    value={status?.totalVolTx?.toLocaleString() ?? "—"} />
            <Stat label="Regime"           value={status?.regime ?? "—"} color="var(--amber)" />
            <Stat label="Vol (bps)"        value={status?.realizedVolBps?.toLocaleString() ?? "—"} />
            <Stat label="Chain ID"         value={status?.chainId?.toString() ?? "—"} />
            <Stat label="Loop interval"    value={status?.loopIntervalMs ? `${status.loopIntervalMs / 1000}s` : "—"} />
            <Stat label="Demo mode"        value={status?.demoMode === false ? "false" : status?.demoMode ? "true" : "—"} color={status?.demoMode === false ? "var(--green)" : "var(--red)"} />
            <Stat label="0G Compute"       value={status?.computeStatus ?? "—"} color={status?.computeStatus === "ready" ? "var(--green)" : "var(--amber)"} />
          </div>
          {status?.computeStatusNote && (
            <div style={{ marginTop: "1rem", fontSize: "1.2rem", color: "var(--text-dim)", borderLeft: "2px solid var(--amber)", paddingLeft: "0.75rem" }}>
              {status.computeStatusNote}
            </div>
          )}
        </section>

        {/* --------- What's live where --------- */}
        <section className="card-hud" style={card}>
          <h2 style={h2}>What is live on which network</h2>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "1.25rem" }}>
            <thead>
              <tr style={{ color: "var(--text-dim)", textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                <th style={th}>Component</th>
                <th style={th}>Mainnet (16661)</th>
                <th style={th}>Testnet (16602)</th>
              </tr>
            </thead>
            <tbody>
              <Row c="0G Chain"   m="✅ Live · 75k+ TXs" t="✅ Live" mOk tOk />
              <Row c="0G Compute" m="⚠ Provider not registered on mainnet inference contract" t="✅ Live · Qwen-2.5-7B via dstack TEE" mWarn tOk />
              <Row c="0G Storage" m="⚠ Indexer not on mainnet" t="✅ Live · ArchiveRegistry Merkle roots" mWarn tOk />
            </tbody>
          </table>
          <div style={{ marginTop: "1rem", fontSize: "1.2rem", color: "var(--text-dim)" }}>
            Same wallet, same code, two networks — switched by environment variable.
            Hackathon rule is &quot;at least one 0G core component integrated&quot; — PROVUS clears that bar on mainnet with the 75k+ TXs above, and exercises all three components end-to-end on testnet.
          </div>
        </section>

        {/* --------- Contracts --------- */}
        <section className="card-hud" style={card}>
          <h2 style={h2}>Smart contracts — 0G Chain Mainnet</h2>
          <div style={{ display: "grid", gap: "0.5rem" }}>
            {CONTRACTS.map((c) => (
              <div key={c.addr} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.5rem", background: "var(--bg-deep)", border: "1px solid var(--border)", borderRadius: 4, gap: "0.5rem", flexWrap: "wrap" }}>
                <div>
                  <div style={{ color: "var(--text-primary)", fontSize: "1.25rem" }}>{c.name}</div>
                  <div style={{ color: "var(--text-dim)", fontSize: "1.1rem", fontFamily: "var(--font-hud)" }}>{c.addr}</div>
                </div>
                <a href={`${EXPLORER}/address/${c.addr}`} target="_blank" rel="noreferrer" style={linkBtn}>
                  View ↗
                </a>
              </div>
            ))}
          </div>
        </section>

        {/* --------- Known limitations --------- */}
        <section className="card-hud" style={card}>
          <h2 style={h2}>Known limitations</h2>
          <ul style={{ color: "var(--text-dim)", fontSize: "1.25rem", lineHeight: 1.7, paddingLeft: "1.2rem" }}>
            <li><b style={{ color: "var(--text-primary)" }}>If 0G Compute mainnet provider isn&apos;t registered</b> → agent keeps writing <code>recordVolatility()</code>, exposes <code>computeStatus: mainnet-not-configured</code>, never fakes a TEE attestation.</li>
            <li><b style={{ color: "var(--text-primary)" }}>If 0G Storage indexer is overloaded</b> → on-chain Merkle root still lands via <code>ArchiveRegistry.archiveBatch()</code>; off-chain blob upload retried with backoff.</li>
            <li><b style={{ color: "var(--text-primary)" }}>If RPC drops mid-cycle</b> → persistent nonce manager retries, never loses sequence; nonce is read from chain on restart.</li>
            <li><b style={{ color: "var(--text-primary)" }}>If the inference fails entirely</b> → cycle is skipped; nothing is written. There is no &quot;simulated&quot; signal path.</li>
          </ul>
        </section>

        {/* --------- Verify yourself --------- */}
        <section className="card-hud" style={card}>
          <h2 style={h2}>Verify in 30 seconds (terminal)</h2>
          <pre style={pre}>
{`curl -s -X POST ${RPC_MAINNET} \\
  -H 'content-type: application/json' \\
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_getTransactionCount",
       "params":["${AGENT_WALLET}","latest"]}'`}
          </pre>
          <pre style={pre}>{`curl -s https://provus-protocol-production.up.railway.app/status`}</pre>
        </section>

        <footer style={{ textAlign: "center", color: "var(--text-faint)", fontSize: "1.1rem", padding: "2rem 0 1rem" }}>
          PROVUS Protocol · 0G APAC Hackathon 2026 · Track 2 (Agentic Trading Arena)
          {" · "}
          <a href="https://github.com/Gideon145/provus-protocol" target="_blank" rel="noreferrer" style={inlineLink}>GitHub</a>
          {" · "}
          <a href={`${EXPLORER_T}/address/${AGENT_WALLET}`} target="_blank" rel="noreferrer" style={inlineLink}>Testnet wallet</a>
        </footer>
      </div>
    </main>
  );
}

/* ---- Tiny components ------------------------------------------------------ */
function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: "1rem", color: "var(--text-dim)", letterSpacing: "0.15em" }}>{label}</div>
      <div style={{ fontFamily: "var(--font-orbitron)", fontSize: "1.9rem", color: color ?? "var(--text-primary)", marginTop: "0.2rem" }}>{value}</div>
    </div>
  );
}

function Row({ c, m, t, mOk, mWarn, tOk }: { c: string; m: string; t: string; mOk?: boolean; mWarn?: boolean; tOk?: boolean }) {
  const cellM = { ...td, color: mOk ? "var(--green)" : mWarn ? "var(--amber)" : "var(--text-dim)" };
  const cellT = { ...td, color: tOk ? "var(--green)" : "var(--text-dim)" };
  return (
    <tr style={{ borderBottom: "1px solid var(--border)" }}>
      <td style={{ ...td, color: "var(--text-primary)" }}>{c}</td>
      <td style={cellM}>{m}</td>
      <td style={cellT}>{t}</td>
    </tr>
  );
}

/* ---- Styles --------------------------------------------------------------- */
const card: React.CSSProperties = { padding: "1.25rem", marginBottom: "1rem" };
const cardLg: React.CSSProperties = { padding: "1.5rem", marginBottom: "1rem" };
const h2: React.CSSProperties = { fontFamily: "var(--font-orbitron)", fontSize: "1.5rem", color: "var(--cyan)", letterSpacing: "0.15em", margin: "0 0 1rem", textTransform: "uppercase" };
const grid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "1rem" };
const th: React.CSSProperties = { padding: "0.5rem 0.5rem", fontSize: "1rem", letterSpacing: "0.15em", fontWeight: 500 };
const td: React.CSSProperties = { padding: "0.5rem 0.5rem", verticalAlign: "top" };
const pre: React.CSSProperties = { background: "var(--bg-deep)", border: "1px solid var(--border)", borderRadius: 4, padding: "0.75rem", fontSize: "1.1rem", color: "var(--text-primary)", overflowX: "auto", marginBottom: "0.5rem" };
const linkBtn: React.CSSProperties = { color: "var(--cyan)", textDecoration: "none", fontSize: "1.2rem", padding: "0.4rem 0.75rem", border: "1px solid var(--border-glow)", borderRadius: 4 };
const btnPrimary: React.CSSProperties = { ...linkBtn, background: "var(--cyan-glow)", color: "var(--cyan)", borderColor: "var(--cyan-dim)" };
const btnSecondary: React.CSSProperties = { ...linkBtn };
const inlineLink: React.CSSProperties = { color: "var(--cyan)", textDecoration: "none" };
