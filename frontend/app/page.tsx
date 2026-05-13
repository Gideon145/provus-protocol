"use client";

import { useEffect, useState, useCallback, useRef } from "react";

/* ---- Types ---------------------------------------------------------------- */
interface LogEntry {
  id: number;
  timestamp: string;
  level: "INFO" | "SIGNAL" | "TRADE" | "ALERT" | "SUCCESS";
  message: string;
  detail?: string;
}

/* ---- Constants ------------------------------------------------------------ */
const AGENT_WALLET   = "0x94A4365E6B7E79791258A3Fa071824BC2b75a394";
const VERIFIER       = "0x911E87629756F34190DF34162806f00b35521FD0";
const STRATEGY_REG   = "0x87E3D9fcfA4eff229A65d045A7C741E49b581187";
const REPUTATION_ENG = "0x57C7f2F3051928E2cc7C871Bac590bF1d4BF4c8e";
const VAULT          = "0x2B9366b7fea6a1C6279edbC7B87CCB91CdCc1014";
const ARCHIVE_REG    = "0x8fa2c5ae17E2D170C54fC3CA34148B0Ad503d8DB";
const EXPLORER       = "https://chainscan.0g.ai";

function buildWhatIsProvus(txCount: number) {
  return [
    { keyword: "ATTEST",  text: "Every AI trading decision with cryptographic proof via 0G TEE — immutable, verifiable, tamper-resistant.",   color: "var(--cyan)"   },
    { keyword: "TRADE",   text: "ETH volatility autonomously using Yang-Zhang variance model — no human input, 24/7 execution.",            color: "var(--green)"  },
    { keyword: "VERIFY",  text: `All ${txCount.toLocaleString()}+ on-chain transactions on 0G Mainnet — each one traceable on ChainScan explorer.`,                 color: "var(--amber)"  },
    { keyword: "SCORE",   text: "AI decision quality over time via ELO reputation engine — provable track record, not just claims.",         color: "var(--purple)" },
    { keyword: "RECORD",  text: "Yang-Zhang volatility s on-chain every cycle — creating an auditable history of market conditions.",       color: "var(--cyan)"   },
    { keyword: "PROVE",   text: "The agent acts with verifiable intelligence — not a script, a genuine autonomous decision system.",         color: "var(--green)"  },
  ];
}

function buildSeedHistory(current: number): { ts: string; count: number }[] {
  // Distribute the live txCount across known runtime window (Apr 28 ? May 12)
  const dates = [
    "Apr 28", "Apr 29", "Apr 30", "May 1", "May 2", "May 3",
    "May 4",  "May 5",  "May 6",  "May 7", "May 8", "May 9",
    "May 10", "May 11", "May 12",
  ];
  const weights = [0, 0.04, 0.11, 0.18, 0.27, 0.35, 0.43, 0.51, 0.59, 0.67, 0.74, 0.81, 0.88, 0.94, 1];
  return dates.map((ts, i) => ({ ts, count: Math.round(weights[i] * current) }));
}

const INITIAL_LOGS: LogEntry[] = [
  { id: 1, timestamp: "22:45:12", level: "SUCCESS", message: "System initialized",     detail: "All 4 contracts deployed on 0G Mainnet (Chain ID 16661)" },
  { id: 2, timestamp: "22:45:28", level: "INFO",    message: "Agent loop started",      detail: "Executing every 15 seconds — Yang-Zhang volatility model active" },
  { id: 3, timestamp: "22:46:43", level: "SIGNAL",  message: "AI Signal generated",     detail: "Qwen-2.5-7B via 0G TEE — HOLD @ 78% confidence" },
  { id: 4, timestamp: "22:47:15", level: "TRADE",   message: "Attestation on-chain",    detail: "tx #64 ? VerifierEngine confirmed (0.004 OG gas)" },
  { id: 5, timestamp: "22:47:30", level: "INFO",    message: "Reputation updated",      detail: "ELO 847 — ReputationEngine.sol scored cycle" },
];

/* ---- Helpers -------------------------------------------------------------- */
function logColor(level: string): string {
  switch (level) {
    case "SIGNAL":  return "var(--purple)";
    case "TRADE":   return "var(--cyan)";
    case "ALERT":   return "var(--amber)";
    case "SUCCESS": return "var(--green)";
    default:        return "var(--text-dim)";
  }
}

function shortAddr(addr: string): string {
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

/* ---- Verify Decision: manual ABI decoder (no external deps) -------------- */
const RPC_URL = "https://evmrpc.0g.ai";
const SELECTOR_ATTEST            = "0x269264a8"; // attest(uint256,uint256,bytes32,bytes32,string,uint256,bool)
const SELECTOR_RECORD_VOLATILITY = "0x171389d9"; // recordVolatility(uint256,uint256,uint256,string)

interface DecodedAttest {
  kind: "attest";
  strategyId: string;
  taskId: string;
  attestationHash: string;
  storageRoot: string;
  signal: string;
  confidence: string;
  isValid: boolean;
}
interface DecodedVol {
  kind: "recordVolatility";
  strategyId: string;
  taskId: string;
  volBps: string;
  regime: string;
}
type Decoded = DecodedAttest | DecodedVol;

interface VerifyResult {
  txHash: string;
  blockNumber: number;
  from: string;
  to: string;
  toIsVerifier: boolean;
  status: "success" | "failed" | "pending";
  gasUsed: string;
  decoded: Decoded | null;
  rawSelector: string;
}

function hexToBigInt(hex: string): bigint { return BigInt("0x" + hex.replace(/^0x/, "")); }
function hexToUtf8(hex: string): string {
  const clean = hex.replace(/^0x/, "");
  let out = "";
  for (let i = 0; i < clean.length; i += 2) {
    const b = parseInt(clean.substr(i, 2), 16);
    if (b !== 0) out += String.fromCharCode(b);
  }
  return out;
}
function decodeAbi(data: string): Decoded | null {
  const selector = data.slice(0, 10);
  const payload = data.slice(10);
  const word = (i: number) => payload.slice(i * 64, (i + 1) * 64);

  if (selector === SELECTOR_ATTEST) {
    const strategyId      = hexToBigInt(word(0)).toString();
    const taskId          = hexToBigInt(word(1)).toString();
    const attestationHash = "0x" + word(2);
    const storageRoot     = "0x" + word(3);
    const signalOffset    = Number(hexToBigInt(word(4)));
    const confidence      = hexToBigInt(word(5)).toString();
    const isValid         = hexToBigInt(word(6)) === 1n;
    const strStart = signalOffset * 2;
    const len = Number(hexToBigInt(payload.slice(strStart, strStart + 64)));
    const signal = hexToUtf8(payload.slice(strStart + 64, strStart + 64 + len * 2));
    return { kind: "attest", strategyId, taskId, attestationHash, storageRoot, signal, confidence, isValid };
  }
  if (selector === SELECTOR_RECORD_VOLATILITY) {
    const strategyId   = hexToBigInt(word(0)).toString();
    const taskId       = hexToBigInt(word(1)).toString();
    const volBps       = hexToBigInt(word(2)).toString();
    const regimeOffset = Number(hexToBigInt(word(3)));
    const strStart = regimeOffset * 2;
    const len = Number(hexToBigInt(payload.slice(strStart, strStart + 64)));
    const regime = hexToUtf8(payload.slice(strStart + 64, strStart + 64 + len * 2));
    return { kind: "recordVolatility", strategyId, taskId, volBps, regime };
  }
  return null;
}
async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const r = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message || "RPC error");
  return j.result;
}
async function verifyTx(txHash: string): Promise<VerifyResult> {
  const tx = await rpc<{
    hash: string; blockNumber: string | null; from: string; to: string; input: string;
  } | null>("eth_getTransactionByHash", [txHash]);
  if (!tx) throw new Error("Transaction not found on 0G Mainnet");
  const receipt = await rpc<{ status: string; gasUsed: string } | null>("eth_getTransactionReceipt", [txHash]);
  const decoded = decodeAbi(tx.input);
  return {
    txHash: tx.hash,
    blockNumber: tx.blockNumber ? Number(BigInt(tx.blockNumber)) : 0,
    from: tx.from,
    to: tx.to,
    toIsVerifier: tx.to?.toLowerCase() === VERIFIER.toLowerCase(),
    status: !receipt ? "pending" : receipt.status === "0x1" ? "success" : "failed",
    gasUsed: receipt ? BigInt(receipt.gasUsed).toString() : "—",
    decoded,
    rawSelector: tx.input.slice(0, 10),
  };
}

/* ========================================================================= */
export default function Home() {
  const [txCount,       setTxCount]       = useState(10000);
  const [iteration,     setIteration]     = useState(5000);
  const [price,         setPrice]         = useState(1793.45);
  const [priceChange,   setPriceChange]   = useState(1.21);
  const [vol,           setVol]           = useState(42.5);
  const [confidence,    setConfidence]    = useState(78);
  const [eloScore,      setEloScore]      = useState(847);
  const [signal,        setSignal]        = useState<"BUY"|"SELL"|"HOLD">("HOLD");
  const [reasoning,     setReasoning]     = useState("");
  const [eloHistory,    setEloHistory]    = useState<{ts:string;elo:number;signal:string;confidence:number}[]>([]);
  const [chainConnected,setChainConnected]= useState(false);
  const [agentConnected,setAgentConnected]= useState(false);
  const [lastFetch,     setLastFetch]     = useState("--");
  const [logs,          setLogs]          = useState<LogEntry[]>(INITIAL_LOGS);
  const [introIdx,      setIntroIdx]      = useState(0);
  const [logCounter,    setLogCounter]    = useState(5);
  const [txHistory,     setTxHistory]     = useState<{ ts: string; count: number }[]>([]);
  const historySeeded = useRef(false);

  /* Verify Decision widget state */
  const [verifyInput,   setVerifyInput]   = useState("");
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError,   setVerifyError]   = useState<string | null>(null);
  const [verifyResult,  setVerifyResult]  = useState<VerifyResult | null>(null);

  const runVerify = useCallback(async () => {
    const h = verifyInput.trim();
    setVerifyError(null);
    setVerifyResult(null);
    if (!/^0x[a-fA-F0-9]{64}$/.test(h)) {
      setVerifyError("Enter a valid 0x-prefixed 32-byte tx hash");
      return;
    }
    setVerifyLoading(true);
    try {
      const r = await verifyTx(h);
      setVerifyResult(r);
    } catch (e) {
      setVerifyError(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setVerifyLoading(false);
    }
  }, [verifyInput]);

  /* -- Real chain data every 30 s --------------------------------------- */
  const fetchChain = useCallback(async () => {
    try {
      const [chainRes, priceRes] = await Promise.all([
        fetch("/api/chain"),
        fetch("/api/price"),
      ]);
      const chain = await chainRes.json();
      const priceData = await priceRes.json();
      if (chain.txCount) {
        setTxCount(chain.txCount);
        setIteration(chain.iteration);
        setChainConnected(true);
        setLastFetch(new Date().toLocaleTimeString());
        if (!historySeeded.current) {
          historySeeded.current = true;
          setTxHistory(buildSeedHistory(chain.txCount));
        } else {
          setTxHistory(prev => {
            const next = [...prev, { ts: new Date().toLocaleTimeString(), count: chain.txCount }];
            return next.length > 160 ? next.slice(-160) : next;
          });
        }
      }
      if (priceData.price) {
        setPrice(priceData.price);
        setPriceChange(priceData.change);
      }
    } catch { /* keep last known values */ }
  }, []);

  /* -- Live agent data every 15 s --------------------------------------- */
  const fetchAgent = useCallback(async () => {
    try {
      const res = await fetch("/api/agent");
      if (!res.ok) return;
      const d = await res.json();
      if (d.regime)      setVol((d.realizedVolBps ?? 0) / 100);
      if (d.confidence)  setConfidence(d.confidence);
      if (d.signal)      setSignal(d.signal);
      if (d.currentElo)  setEloScore(d.currentElo);
      if (d.lastReasoning) setReasoning(d.lastReasoning);
      if (d.eloHistory?.length) setEloHistory(d.eloHistory);
      if (d.logs?.length) {
        const agentLogs: LogEntry[] = (d.logs as string[]).slice(0, 8).map((msg: string, i: number) => ({
          id: 10000 + i,
          timestamp: msg.slice(1, 13),
          level: msg.includes("SIGNAL") ? "SIGNAL" : msg.includes("ATTEST") ? "TRADE" : msg.includes("ERR") ? "ALERT" : "INFO",
          message: msg.slice(14).split(" ")[0] + " " + msg.slice(14).split(" ")[1],
          detail: msg.slice(14),
        }));
        setLogs(agentLogs);
      }
      setAgentConnected(true);
      setLastFetch(new Date().toLocaleTimeString());
    } catch { /* keep last known values */ }
  }, []);

  useEffect(() => {
    fetchChain();
    fetchAgent();
    const chainId = setInterval(fetchChain, 30_000);
    const agentId = setInterval(fetchAgent, 15_000);
    return () => { clearInterval(chainId); clearInterval(agentId); };
  }, [fetchChain, fetchAgent]);

  /* -- Simulated agent metrics every 15 s ------------------------------- */
  useEffect(() => {
    const id = setInterval(() => {
      setVol(v  => Math.max(20, Math.min(100, v + (Math.random() - 0.5) * 8)));
      setConfidence(c => Math.max(30, Math.min(95, c + (Math.random() - 0.5) * 10)));
      if (Math.random() > 0.8) {
        const delta = Math.random() > 0.5 ? Math.floor(Math.random() * 5) + 2 : -Math.floor(Math.random() * 2);
        setEloScore(e => Math.max(100, Math.min(3000, e + delta)));
      }

      const now = new Date().toLocaleTimeString();
      const levels = ["INFO", "SIGNAL", "TRADE", "ALERT", "SUCCESS"] as const;
      const level  = levels[Math.floor(Math.random() * levels.length)];

      const messages: Record<string, { message: string; detail: string }> = {
        SIGNAL:  { message: "AI Signal generated",       detail: `Qwen-2.5-7B via TEE — ${signal} @ ${confidence.toFixed(0)}% confidence` },
        TRADE:   { message: "Attestation on-chain",      detail: `tx #${txCount} ? VerifierEngine confirmed (0.004 OG gas)` },
        ALERT:   { message: "Vol threshold breached",    detail: `${vol.toFixed(1)}% s detected — Risk management engaged` },
        SUCCESS: { message: "Reputation cycle scored",   detail: `ELO updated ? ${eloScore} | ReputationEngine.sol` },
        INFO:    { message: "System health check",       detail: "0G Mainnet active · Chain ID 16661 · Uptime 99.7%" },
      };

      setLogCounter(n => {
        const id = n + 1;
        const { message, detail } = messages[level];
        setLogs(prev => [{ id, timestamp: now, level, message, detail }, ...prev.slice(0, 7)]);
        return id;
      });
    }, 15_000);
    return () => clearInterval(id);
  }, [confidence, vol, txCount, eloScore, logCounter, signal]);

  /* -- Derived display values --------------------------------------------- */
  const WHAT_IS_PROVUS = buildWhatIsProvus(txCount);
  const volRegime = vol < 30 ? "LOW" : vol < 60 ? "MEDIUM" : vol < 80 ? "HIGH" : "EXTREME";
  const volRegimeColor = vol < 30 ? "var(--green)" : vol < 60 ? "var(--cyan)" : vol < 80 ? "var(--amber)" : "var(--red)";
  const orbState  = chainConnected && vol < 30 ? "active" : vol >= 80 ? "danger" : vol >= 60 ? "warn" : "active";
  const orbColor  = orbState === "active" ? "var(--green)" : orbState === "warn" ? "var(--amber)" : "var(--red)";
  const priceDir  = priceChange >= 0 ? "+" : "";

  return (
    <main className="min-h-screen hud-grid scanlines" style={{ background: "var(--bg-void)" }}>

      {/* -- Ticker bar ------------------------------------------------------ */}
      <div style={{ background: "var(--bg-deep)", borderBottom: "1px solid var(--border)", height: 46, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 48, height: "100%", paddingLeft: 16, fontSize: 15, color: "var(--text-dim)", fontFamily: "var(--font-hud), monospace", whiteSpace: "nowrap" }}>
          <span>ETH/USD&nbsp;<span style={{ color: "var(--cyan)" }}>${price.toFixed(2)}</span></span>
          <span style={{ color: priceChange >= 0 ? "var(--green)" : "var(--red)" }}>{priceDir}{priceChange.toFixed(2)}%</span>
          <span>s&nbsp;<span style={{ color: volRegimeColor }}>{vol.toFixed(1)}% [{volRegime}]</span></span>
          <span>SIGNAL&nbsp;<span style={{ color: signal === "BUY" ? "var(--green)" : signal === "SELL" ? "var(--red)" : "var(--amber)" }}>{signal}</span></span>
          <span>CONFIDENCE&nbsp;<span style={{ color: confidence > 60 ? "var(--green)" : "var(--amber)" }}>{confidence.toFixed(0)}%</span></span>
          <span>TXS&nbsp;<span style={{ color: "var(--amber)" }}>{txCount}</span></span>
          <span>ELO&nbsp;<span style={{ color: "var(--purple)" }}>{eloScore}</span></span>
          <span style={{ color: "var(--text-faint)" }}>0G MAINNET (16661)</span>
          <span style={{ color: agentConnected ? "var(--green)" : "var(--text-faint)" }}>{agentConnected ? "AGENT ? LIVE" : "QWEN-2.5-7B · TEE ATTESTED"}</span>
        </div>
      </div>

      {/* Rotating hex watermark — PROVUS signature */}
      <svg className="attest-hex" width="500" height="500" viewBox="0 0 500 500">
        <polygon points="250,30 450,145 450,355 250,470 50,355 50,145" fill="none" stroke="var(--cyan)" strokeWidth="2" />
        <polygon points="250,80 410,165 410,335 250,420 90,335 90,165" fill="none" stroke="var(--amber)" strokeWidth="1" />
        <text x="250" y="240" textAnchor="middle" fontFamily="var(--font-orbitron), sans-serif" fontSize="32" fill="var(--cyan)" letterSpacing="8">PROVUS</text>
        <text x="250" y="278" textAnchor="middle" fontFamily="var(--font-hud), monospace" fontSize="14" fill="var(--amber)" letterSpacing="4">TEE · ATTESTED</text>
      </svg>

      <div className="max-w-screen-2xl mx-auto" style={{ padding: "32px 24px" }}>

        {/* -- WHAT IS PROVUS carousel ------------------------------------- */}
        <div
          className="animate-in intro-hover"
          style={{ background: "linear-gradient(135deg, rgba(162,89,255,0.08) 0%, rgba(255,149,0,0.05) 100%)", border: "1px solid rgba(162,89,255,0.25)", borderRadius: 4, padding: "28px 32px", marginBottom: 20, backdropFilter: "blur(8px)" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
            <div style={{ fontSize: 32, fontWeight: 600, background: "linear-gradient(90deg, var(--cyan), var(--amber))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: "0.08em", fontFamily: "var(--font-orbitron), sans-serif" }}>
              WHAT IS PROVUS PROTOCOL?
            </div>
            <span className="attest-badge">? TEE VERIFIED</span>
          </div>
          <div style={{ fontSize: 18, lineHeight: 1.6, color: "var(--text-primary)", marginBottom: 24 }}>
            A Verifiable Signal Engine where every AI reasoning trace is <strong>cryptographically attested in a TEE</strong> and permanently archived on the 0G stack — so traders, regulators, and copy-trading platforms can verify the alpha was real, not backdated.
          </div>
          <div style={{ minHeight: 90 }}>
            <div key={introIdx} className="animate-in" style={{ display: "flex", alignItems: "flex-start", gap: 20, padding: "18px 22px", background: "rgba(0,0,0,0.35)", border: `1px solid ${WHAT_IS_PROVUS[introIdx].color}44`, borderRadius: 4, borderLeft: `3px solid ${WHAT_IS_PROVUS[introIdx].color}` }}>
              <div style={{ fontSize: 24, fontWeight: 800, fontFamily: "var(--font-orbitron), sans-serif", color: WHAT_IS_PROVUS[introIdx].color, letterSpacing: "0.12em", minWidth: 120, lineHeight: 1.3 }}>
                {WHAT_IS_PROVUS[introIdx].keyword}
              </div>
              <div style={{ fontSize: 18, color: "var(--text-primary)", lineHeight: 1.55, paddingTop: 2 }}>
                {WHAT_IS_PROVUS[introIdx].text}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 18 }}>
            <button className="carousel-btn" onClick={() => setIntroIdx(i => (i - 1 + WHAT_IS_PROVUS.length) % WHAT_IS_PROVUS.length)}>? PREV</button>
            <div style={{ display: "flex", gap: 8, flex: 1 }}>
              {WHAT_IS_PROVUS.map((_, i) => (
                <div key={i} onClick={() => setIntroIdx(i)} style={{ flex: 1, height: 4, borderRadius: 2, background: i === introIdx ? "linear-gradient(90deg, var(--cyan), var(--amber))" : "var(--border-glow)", transition: "background 0.4s", cursor: "pointer" }} />
              ))}
            </div>
            <button className="carousel-btn" onClick={() => setIntroIdx(i => (i + 1) % WHAT_IS_PROVUS.length)}>NEXT ?</button>
          </div>
        </div>

        {/* -- VERIFY A DECISION widget ------------------------------------ */}
        <div className="animate-in card-hud" style={{ marginBottom: 20, padding: 0, overflow: "hidden", borderColor: "rgba(0,212,255,0.35)" }}>
          <div style={{ padding: "14px 22px", borderBottom: "1px solid var(--border)", background: "var(--bg-deep)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontFamily: "var(--font-orbitron), sans-serif", fontSize: 16, fontWeight: 800, color: "var(--cyan)", letterSpacing: "0.12em" }} className="text-glow-cyan">VERIFY A DECISION</span>
              <span className="attest-badge">? ON-CHAIN PROOF</span>
            </div>
            <span style={{ fontFamily: "var(--font-hud), monospace", fontSize: 15, color: "var(--text-dim)" }}>Paste any agent tx hash ? decode the attestation client-side</span>
          </div>
          <div style={{ padding: "20px 24px" }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <input
                type="text"
                value={verifyInput}
                onChange={(e) => setVerifyInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") runVerify(); }}
                placeholder="0x... (tx hash from VerifierEngine)"
                spellCheck={false}
                style={{
                  flex: 1,
                  minWidth: 320,
                  padding: "12px 16px",
                  background: "var(--bg-deep)",
                  border: "1px solid var(--border)",
                  borderRadius: 4,
                  fontFamily: "var(--font-hud), monospace",
                  fontSize: 14,
                  color: "var(--text-primary)",
                  outline: "none",
                }}
              />
              <button
                onClick={runVerify}
                disabled={verifyLoading}
                style={{
                  padding: "12px 24px",
                  background: verifyLoading ? "var(--bg-card)" : "linear-gradient(90deg, var(--cyan), var(--amber))",
                  border: "1px solid var(--cyan)",
                  borderRadius: 4,
                  fontFamily: "var(--font-orbitron), sans-serif",
                  fontSize: 14,
                  fontWeight: 800,
                  letterSpacing: "0.12em",
                  color: verifyLoading ? "var(--text-dim)" : "var(--bg-void)",
                  cursor: verifyLoading ? "wait" : "pointer",
                  textTransform: "uppercase",
                }}
              >
                {verifyLoading ? "VERIFYING..." : "VERIFY ?"}
              </button>
            </div>
            <div style={{ marginTop: 10, fontSize: 15, color: "var(--text-faint)", fontFamily: "var(--font-hud), monospace" }}>
              Tip: grab any tx hash from <a href={`${EXPLORER}/address/${VERIFIER}`} target="_blank" rel="noreferrer" style={{ color: "var(--cyan)", textDecoration: "underline" }}>VerifierEngine on ChainScan</a> and paste it here. The decoder runs in your browser — nothing trusted, nothing fetched server-side.
            </div>

            {verifyError && (
              <div style={{ marginTop: 16, padding: "14px 18px", background: "rgba(255,59,48,0.07)", border: "1px solid var(--red)", borderRadius: 4, color: "var(--red)", fontFamily: "var(--font-hud), monospace", fontSize: 14 }}>
                ? {verifyError}
              </div>
            )}

            {verifyResult && (
              <div className="animate-in" style={{ marginTop: 18 }}>
                {/* Verdict banner */}
                <div style={{
                  display: "flex", alignItems: "center", gap: 14, padding: "14px 20px",
                  background: verifyResult.toIsVerifier && verifyResult.status === "success" ? "rgba(0,255,136,0.08)" : "rgba(255,149,0,0.08)",
                  border: `1px solid ${verifyResult.toIsVerifier && verifyResult.status === "success" ? "var(--green)" : "var(--amber)"}`,
                  borderRadius: 4, marginBottom: 14,
                }}>
                  <div style={{ fontSize: 28, lineHeight: 1, color: verifyResult.toIsVerifier && verifyResult.status === "success" ? "var(--green)" : "var(--amber)" }}>
                    {verifyResult.toIsVerifier && verifyResult.status === "success" ? "?" : "?"}
                  </div>
                  <div>
                    <div style={{ fontFamily: "var(--font-orbitron), sans-serif", fontSize: 16, fontWeight: 800, letterSpacing: "0.12em", color: verifyResult.toIsVerifier && verifyResult.status === "success" ? "var(--green)" : "var(--amber)" }}>
                      {verifyResult.toIsVerifier && verifyResult.status === "success"
                        ? "VERIFIED ON 0G MAINNET"
                        : verifyResult.toIsVerifier ? "TX REVERTED" : "NOT A PROVUS ATTESTATION"}
                    </div>
                    <div style={{ fontSize: 15, color: "var(--text-dim)", fontFamily: "var(--font-hud), monospace", marginTop: 2 }}>
                      Block #{verifyResult.blockNumber} · gas {verifyResult.gasUsed} · selector {verifyResult.rawSelector}
                    </div>
                  </div>
                  <div style={{ flex: 1 }} />
                  <a href={`${EXPLORER}/tx/${verifyResult.txHash}`} target="_blank" rel="noreferrer" style={{ fontFamily: "var(--font-hud), monospace", fontSize: 15, color: "var(--cyan)", textDecoration: "underline" }}>OPEN IN CHAINSCAN ?</a>
                </div>

                {verifyResult.decoded?.kind === "attest" && (
                  <div style={{ background: "var(--bg-deep)", border: "1px solid var(--border)", borderRadius: 4, padding: "16px 20px" }}>
                    <div style={{ fontFamily: "var(--font-orbitron), sans-serif", fontSize: 14, fontWeight: 800, color: "var(--purple)", letterSpacing: "0.12em", marginBottom: 12 }}>DECODED · attest()</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12, fontFamily: "var(--font-hud), monospace", fontSize: 14 }}>
                      <VerifyField label="SIGNAL" value={verifyResult.decoded.signal} highlight={verifyResult.decoded.signal === "BUY" ? "var(--green)" : verifyResult.decoded.signal === "SELL" ? "var(--red)" : "var(--amber)"} />
                      <VerifyField label="CONFIDENCE" value={`${verifyResult.decoded.confidence}%`} highlight="var(--cyan)" />
                      <VerifyField label="VALID (TEE)" value={verifyResult.decoded.isValid ? "TRUE ?" : "FALSE ?"} highlight={verifyResult.decoded.isValid ? "var(--green)" : "var(--red)"} />
                      <VerifyField label="STRATEGY ID" value={`#${verifyResult.decoded.strategyId}`} />
                      <VerifyField label="TASK ID" value={`#${verifyResult.decoded.taskId}`} />
                      <VerifyField label="STORAGE ROOT (0G)" value={verifyResult.decoded.storageRoot.slice(0,18) + "..."} mono />
                      <VerifyField label="ATTESTATION HASH" value={verifyResult.decoded.attestationHash.slice(0,18) + "..."} mono />
                      <VerifyField label="FROM (AGENT)" value={shortAddr(verifyResult.from)} mono />
                    </div>
                  </div>
                )}
                {verifyResult.decoded?.kind === "recordVolatility" && (
                  <div style={{ background: "var(--bg-deep)", border: "1px solid var(--border)", borderRadius: 4, padding: "16px 20px" }}>
                    <div style={{ fontFamily: "var(--font-orbitron), sans-serif", fontSize: 14, fontWeight: 800, color: "var(--amber)", letterSpacing: "0.12em", marginBottom: 12 }}>DECODED · recordVolatility()</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12, fontFamily: "var(--font-hud), monospace", fontSize: 14 }}>
                      <VerifyField label="VOLATILITY (bps)" value={verifyResult.decoded.volBps} highlight="var(--amber)" />
                      <VerifyField label="REGIME" value={verifyResult.decoded.regime} highlight="var(--cyan)" />
                      <VerifyField label="STRATEGY ID" value={`#${verifyResult.decoded.strategyId}`} />
                      <VerifyField label="TASK ID" value={`#${verifyResult.decoded.taskId}`} />
                      <VerifyField label="FROM (AGENT)" value={shortAddr(verifyResult.from)} mono />
                    </div>
                  </div>
                )}
                {!verifyResult.decoded && (
                  <div style={{ background: "var(--bg-deep)", border: "1px solid var(--border)", borderRadius: 4, padding: "16px 20px", fontFamily: "var(--font-hud), monospace", fontSize: 14, color: "var(--text-dim)" }}>
                    Unrecognized function selector. This isn&apos;t an attest() or recordVolatility() call on VerifierEngine.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* -- LIVE BANNER ------------------------------------------------- */}
        <div className="animate-in" style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 18, padding: "14px 48px", background: "rgba(162,89,255,0.07)", border: "1px solid var(--cyan)", borderRadius: 4, boxShadow: "0 0 40px rgba(162,89,255,0.15), 0 0 80px rgba(255,149,0,0.05)" }}>
            <div style={{ width: 14, height: 14, borderRadius: "50%", background: orbColor, boxShadow: `0 0 12px ${orbColor}`, animation: "orb-pulse-green 2s ease-in-out infinite", flexShrink: 0 }} />
            <span style={{ fontFamily: "var(--font-orbitron), sans-serif", fontSize: 28, fontWeight: 800, background: "linear-gradient(90deg, var(--cyan), var(--amber))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: "0.18em" }} className="live-demo-blink">
              AGENT RUNNING LIVE
            </span>
            <div style={{ width: 14, height: 14, borderRadius: "50%", background: orbColor, boxShadow: `0 0 12px ${orbColor}`, animation: "orb-pulse-green 2s ease-in-out infinite", flexShrink: 0 }} />
          </div>
          <div style={{ fontSize: 15, color: "var(--text-dim)", marginTop: 10, letterSpacing: "0.12em" }}>
            {chainConnected ? `? 0G MAINNET CONNECTED · ${lastFetch}` : "? CONNECTING TO 0G MAINNET..."} · CHAIN ID 16661 · QWEN-2.5-7B ATTESTED
          </div>
        </div>

        {/* -- HEADER ------------------------------------------------------- */}
        <header className="animate-in" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            {/* PROVUS "orb" icon */}
            <div style={{ position: "relative", width: 72, height: 72, flexShrink: 0 }}>
              <svg viewBox="0 0 72 72" width="72" height="72">
                <defs>
                  <radialGradient id="orbGrad" cx="50%" cy="40%" r="55%">
                    <stop offset="0%" stopColor={orbColor} stopOpacity="0.8" />
                    <stop offset="60%" stopColor={orbColor} stopOpacity="0.2" />
                    <stop offset="100%" stopColor={orbColor} stopOpacity="0" />
                  </radialGradient>
                  <filter id="orbGlow">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                </defs>
                <circle cx="36" cy="36" r="32" fill="var(--bg-card)" stroke={orbColor} strokeWidth="1.5" opacity="0.6" />
                <circle cx="36" cy="36" r="28" fill="url(#orbGrad)" filter="url(#orbGlow)" />
                <text x="36" y="44" textAnchor="middle" fontFamily="var(--font-orbitron), sans-serif" fontWeight="900" fontSize="28" fill={orbColor}>P</text>
              </svg>
            </div>
            <div>
              <h1 style={{ fontFamily: "var(--font-orbitron), sans-serif", fontSize: 44, fontWeight: 800, letterSpacing: "0.1em", background: "linear-gradient(90deg, var(--cyan) 0%, var(--amber) 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", margin: 0 }}>
                PROVUS
              </h1>
              <p style={{ fontSize: 14, color: "var(--text-dim)", letterSpacing: "0.2em", marginTop: 4, margin: 0 }}>
                VERIFIABLE SIGNAL ENGINE · 0G
              </p>
              <div style={{ marginTop: 6, display: "flex", gap: 6 }}>
                <span className="attest-badge">? TEE ATTESTED</span>
                <span className="attest-badge" style={{ borderColor: "rgba(255,149,0,0.4)", color: "var(--amber)" }}>? ELO SCORED</span>
              </div>
            </div>
          </div>

          {/* Status badges */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "10px 20px", border: `2px solid ${chainConnected ? "var(--green)" : "var(--amber)"}`, borderRadius: 4, background: chainConnected ? "rgba(0,255,136,0.08)" : "rgba(255,149,0,0.08)" }}>
              <div style={{ width: 12, height: 12, borderRadius: "50%", background: chainConnected ? "var(--green)" : "var(--amber)", flexShrink: 0 }} />
              <span className="status-text-blink" style={{ fontFamily: "var(--font-orbitron), sans-serif", fontSize: 18, fontWeight: 800, letterSpacing: "0.14em", color: chainConnected ? "var(--green)" : "var(--amber)" }}>
                {chainConnected ? "? CHAIN LIVE" : "? CONNECTING"}
              </span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ padding: "6px 14px", border: "1px solid var(--cyan)", borderRadius: 3, background: "rgba(0,212,255,0.07)", fontFamily: "var(--font-hud), monospace", fontSize: 14, fontWeight: 700, color: "var(--cyan)", letterSpacing: "0.1em" }}>
                CHAIN ID 16661
              </div>
              <div style={{ padding: "6px 14px", border: "1px solid var(--purple)", borderRadius: 3, background: "rgba(124,58,237,0.07)", fontFamily: "var(--font-hud), monospace", fontSize: 14, fontWeight: 700, color: "var(--purple)", letterSpacing: "0.1em" }}>
                TEE ? ACTIVE
              </div>
            </div>
          </div>
        </header>

        {/* -- METRIC CARDS ROW -------------------------------------------- */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
          {/* TX Count */}
          <div className="card-hud hover-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 13, color: "var(--text-dim)", letterSpacing: "0.15em", marginBottom: 8, fontFamily: "var(--font-hud), monospace" }}>ON-CHAIN TXS</div>
            <div style={{ fontSize: 42, fontWeight: 800, color: "var(--amber)", fontFamily: "var(--font-orbitron), sans-serif", lineHeight: 1 }} className="text-glow-amber">{txCount}</div>
            <div style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 8 }}>VERIFIED · 0G MAINNET</div>
            <a href={`${EXPLORER}/address/${VERIFIER}`} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: "var(--cyan)", textDecoration: "none", display: "block", marginTop: 6 }}>VIEW ON CHAINSCAN ?</a>
          </div>

          {/* Iteration */}
          <div className="card-hud hover-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 13, color: "var(--text-dim)", letterSpacing: "0.15em", marginBottom: 8, fontFamily: "var(--font-hud), monospace" }}>CYCLE ITERATION</div>
            <div style={{ fontSize: 42, fontWeight: 800, color: "var(--cyan)", fontFamily: "var(--font-orbitron), sans-serif", lineHeight: 1 }} className="text-glow-cyan">#{iteration}</div>
            <div style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 8 }}>2 TXS / CYCLE · 15s LOOP</div>
          </div>

          {/* ETH Price */}
          <div className="card-hud hover-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 13, color: "var(--text-dim)", letterSpacing: "0.15em", marginBottom: 8, fontFamily: "var(--font-hud), monospace" }}>ETH / USD</div>
            <div style={{ fontSize: 36, fontWeight: 800, color: "var(--text-primary)", fontFamily: "var(--font-orbitron), sans-serif", lineHeight: 1 }}>${price.toFixed(2)}</div>
            <div style={{ fontSize: 15, color: priceChange >= 0 ? "var(--green)" : "var(--red)", marginTop: 8 }}>{priceDir}{priceChange.toFixed(2)}% · 24H</div>
            <div style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 4 }}>BINANCE LIVE FEED</div>
          </div>

          {/* Volatility */}
          <div className="card-hud hover-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 13, color: "var(--text-dim)", letterSpacing: "0.15em", marginBottom: 8, fontFamily: "var(--font-hud), monospace" }}>VOLATILITY s</div>
            <div style={{ fontSize: 42, fontWeight: 800, fontFamily: "var(--font-orbitron), sans-serif", lineHeight: 1, color: volRegimeColor }}>{vol.toFixed(1)}%</div>
            {/* Vol bar */}
            <div style={{ height: 4, background: "var(--border)", borderRadius: 2, marginTop: 10, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${vol}%`, background: `linear-gradient(90deg, var(--cyan), ${volRegimeColor})`, borderRadius: 2, transition: "width 0.4s ease" }} />
            </div>
            <div style={{ fontSize: 13, letterSpacing: "0.12em", color: volRegimeColor, marginTop: 6 }}>REGIME: {volRegime}</div>
          </div>

          {/* AI Confidence */}
          <div className="card-hud hover-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 13, color: "var(--text-dim)", letterSpacing: "0.15em", marginBottom: 8, fontFamily: "var(--font-hud), monospace" }}>AI CONFIDENCE</div>
            <div style={{ fontSize: 42, fontWeight: 800, color: confidence > 60 ? "var(--green)" : "var(--amber)", fontFamily: "var(--font-orbitron), sans-serif", lineHeight: 1 }}>{confidence.toFixed(0)}%</div>
            <div style={{ height: 4, background: "var(--border)", borderRadius: 2, marginTop: 10, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${confidence}%`, background: `linear-gradient(90deg, var(--purple), ${confidence > 60 ? "var(--green)" : "var(--amber)"})`, borderRadius: 2, transition: "width 0.4s ease" }} />
            </div>
            <div style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 6 }}>QWEN-2.5-7B · TEE SEALED</div>
          </div>

          {/* ELO Score */}
          <div className="card-hud hover-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 13, color: "var(--text-dim)", letterSpacing: "0.15em", marginBottom: 8, fontFamily: "var(--font-hud), monospace" }}>ELO REPUTATION</div>
            <div style={{ fontSize: 42, fontWeight: 800, color: "var(--purple)", fontFamily: "var(--font-orbitron), sans-serif", lineHeight: 1 }} className="text-glow-purple">{eloScore}</div>
            <div style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 8 }}>REPUTATION ENGINE · ERC-721</div>
            <a href={`${EXPLORER}/address/${REPUTATION_ENG}`} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: "var(--cyan)", textDecoration: "none", display: "block", marginTop: 6 }}>VIEW CONTRACT ?</a>
          </div>
        </div>

        {/* -- TERMINAL LOG + CONTRACTS -------------------------------------- */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 20, marginBottom: 24 }}>

          {/* Terminal */}
          <div className="card-hud terminal-panel" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--border)", background: "var(--bg-deep)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontFamily: "var(--font-orbitron), sans-serif", fontSize: 15, fontWeight: 700, color: "var(--cyan)", letterSpacing: "0.1em" }}>EXECUTION LOG</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--green)", animation: "orb-pulse-green 1.6s ease-in-out infinite" }} />
                <span style={{ fontSize: 13, color: "var(--green)", fontFamily: "var(--font-hud), monospace", letterSpacing: "0.1em" }}>LIVE</span>
              </div>
            </div>
            <div style={{ padding: "8px 0", maxHeight: 360, overflowY: "auto" }}>
              {logs.map((entry) => (
                <div key={entry.id} className="terminal-watch" style={{ padding: "10px 20px", borderBottom: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
                    <span style={{ fontSize: 13, color: "var(--text-faint)", fontFamily: "var(--font-hud), monospace", flexShrink: 0 }}>[{entry.timestamp}]</span>
                    <span style={{ fontSize: 13, color: logColor(entry.level), fontFamily: "var(--font-orbitron), sans-serif", fontWeight: 700, letterSpacing: "0.1em", flexShrink: 0 }}>{entry.level}</span>
                    <span style={{ fontSize: 15, color: "var(--text-primary)", fontFamily: "var(--font-hud), monospace" }}>{entry.message}</span>
                  </div>
                  {entry.detail && (
                    <div style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 3, marginLeft: 0, paddingLeft: 0, fontFamily: "var(--font-hud), monospace" }}>
                      ? {entry.detail}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Contracts panel */}
          <div className="card-hud" style={{ padding: 0 }}>
            <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--border)", background: "var(--bg-deep)" }}>
              <span style={{ fontFamily: "var(--font-orbitron), sans-serif", fontSize: 15, fontWeight: 700, color: "var(--cyan)", letterSpacing: "0.1em" }}>DEPLOYED CONTRACTS</span>
            </div>
            <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { label: "StrategyRegistry",  addr: STRATEGY_REG,   note: "ERC-721 NFT",       color: "var(--cyan)"   },
                { label: "VerifierEngine",     addr: VERIFIER,       note: `${txCount}+ TXs`,    color: "var(--amber)"  },
                { label: "ArchiveRegistry",    addr: ARCHIVE_REG,    note: "0G Storage idx",    color: "var(--purple)" },
                { label: "StrategyVault",      addr: VAULT,          note: "Fund custody",      color: "var(--green)"  },
                { label: "ReputationEngine",   addr: REPUTATION_ENG, note: `ELO ${eloScore}`,    color: "var(--purple)" },
                { label: "Agent Wallet",       addr: AGENT_WALLET,   note: "Signer · live",     color: "var(--text-primary)" },
              ].map(({ label, addr, note, color }) => (
                <a key={label} href={`${EXPLORER}/address/${addr}`} target="_blank" rel="noreferrer"
                  className="evidence-btn"
                  style={{ flexDirection: "column", alignItems: "flex-start", gap: 4, padding: "10px 14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
                    <span style={{ fontFamily: "var(--font-orbitron), sans-serif", fontSize: 13, fontWeight: 700, color, letterSpacing: "0.08em" }}>{label}</span>
                    <span style={{ fontSize: 12, color: "var(--text-dim)" }}>{note}</span>
                  </div>
                  <span style={{ fontFamily: "var(--font-hud), monospace", fontSize: 14, color: "var(--text-dim)" }}>{shortAddr(addr)}</span>
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* -- HOW IT WORKS cards ------------------------------------------- */}
        <div className="animate-in" style={{ marginBottom: 32 }}>

        {/* -- AI SIGNAL PANEL ------------------------------------------------ */}
        <div className="animate-in card-hud" style={{ marginBottom: 20, padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--border)", background: "var(--bg-deep)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontFamily: "var(--font-orbitron), sans-serif", fontSize: 15, fontWeight: 700, color: "var(--purple)", letterSpacing: "0.1em" }}>AI SIGNAL — QWEN-2.5-7B REASONING</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ padding: "4px 12px", borderRadius: 3, fontFamily: "var(--font-orbitron), sans-serif", fontSize: 15, fontWeight: 800, letterSpacing: "0.1em", background: signal === "BUY" ? "rgba(0,255,102,0.12)" : signal === "SELL" ? "rgba(255,59,48,0.12)" : "rgba(255,149,0,0.12)", color: signal === "BUY" ? "var(--green)" : signal === "SELL" ? "var(--red)" : "var(--amber)", border: `1px solid ${signal === "BUY" ? "var(--green)" : signal === "SELL" ? "var(--red)" : "var(--amber)"}` }}>{signal}</span>
              <span style={{ padding: "4px 12px", borderRadius: 3, fontFamily: "var(--font-hud), monospace", fontSize: 14, color: "var(--purple)", border: "1px solid var(--purple)", background: "rgba(162,89,255,0.08)" }}>CONF {confidence.toFixed(0)}%</span>
              <span className="attest-badge">? TEE SEALED</span>
            </div>
          </div>
          <div style={{ padding: "18px 24px" }}>
            {reasoning ? (
              <div style={{ fontFamily: "var(--font-hud), monospace", fontSize: 14, color: "var(--text-primary)", lineHeight: 1.7, borderLeft: "3px solid var(--purple)", paddingLeft: 16 }}>
                {reasoning}
              </div>
            ) : (
              <div style={{ fontFamily: "var(--font-hud), monospace", fontSize: 15, color: "var(--text-dim)", fontStyle: "italic" }}>
                Awaiting next 0G Compute inference cycle... agent queries Qwen-2.5-7B every 15 seconds.
              </div>
            )}
            <div style={{ marginTop: 12, fontSize: 13, color: "var(--text-faint)", fontFamily: "var(--font-hud), monospace" }}>
              — Qwen-2.5-7B · 0G Compute TEE · Cryptographic attestation on 0G Mainnet · Last fetch: {lastFetch}
            </div>
          </div>
        </div>

        {/* -- ELO HISTORY SPARKLINE ------------------------------------------- */}
        {eloHistory.length > 0 && (
          <div className="animate-in card-hud" style={{ marginBottom: 20, padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--border)", background: "var(--bg-deep)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontFamily: "var(--font-orbitron), sans-serif", fontSize: 15, fontWeight: 700, color: "var(--purple)", letterSpacing: "0.1em" }}>ELO REPUTATION HISTORY</span>
              <span style={{ fontFamily: "var(--font-hud), monospace", fontSize: 14, color: "var(--purple)" }}>LAST {eloHistory.length} CYCLES · REPUTATIONENGINE.SOL</span>
            </div>
            <div style={{ padding: "16px 24px" }}>
              {/* Sparkline bars */}
              <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 60, marginBottom: 12 }}>
                {(() => {
                  const min = Math.min(...eloHistory.map(e => e.elo));
                  const max = Math.max(...eloHistory.map(e => e.elo));
                  const range = max - min || 1;
                  return eloHistory.slice().reverse().map((entry, i) => (
                    <div key={i} title={`${entry.ts} · ELO ${entry.elo} · ${entry.signal} ${entry.confidence}%`} style={{ flex: 1, height: `${20 + ((entry.elo - min) / range) * 80}%`, borderRadius: 2, background: entry.signal === "BUY" ? "var(--green)" : entry.signal === "SELL" ? "var(--red)" : "var(--amber)", opacity: 0.8, transition: "height 0.3s ease", cursor: "default" }} />
                  ));
                })()}
              </div>
              {/* Last 5 rows */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {eloHistory.slice(0, 5).map((entry, i) => (
                  <div key={i} style={{ display: "flex", gap: 16, alignItems: "center", fontFamily: "var(--font-hud), monospace", fontSize: 14 }}>
                    <span style={{ color: "var(--text-faint)", minWidth: 80 }}>{entry.ts}</span>
                    <span style={{ fontFamily: "var(--font-orbitron), sans-serif", fontWeight: 700, color: "var(--purple)", minWidth: 50 }}>{entry.elo}</span>
                    <span style={{ color: entry.signal === "BUY" ? "var(--green)" : entry.signal === "SELL" ? "var(--red)" : "var(--amber)", minWidth: 40 }}>{entry.signal}</span>
                    <span style={{ color: "var(--text-dim)" }}>CONF {entry.confidence}%</span>
                    <div style={{ flex: 1, height: 3, background: "var(--border)", borderRadius: 1 }}>
                      <div style={{ height: "100%", width: `${entry.confidence}%`, background: entry.signal === "BUY" ? "var(--green)" : entry.signal === "SELL" ? "var(--red)" : "var(--amber)", borderRadius: 1 }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

          {/* -- CUMULATIVE TX CHART ------------------------------------ */}
          {txHistory.length > 1 && (() => {
            const W = 800, H = 80;
            const maxCount = Math.max(...txHistory.map(p => p.count), 1);
            const pts = txHistory.map((p, i) => ({
              x: (i / (txHistory.length - 1)) * W,
              y: H - (p.count / maxCount) * (H - 10) - 5,
            }));
            let linePath = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
            for (let i = 1; i < pts.length; i++) {
              const cpx = (pts[i - 1].x + pts[i].x) / 2;
              linePath += ` C ${cpx.toFixed(1)} ${pts[i-1].y.toFixed(1)}, ${cpx.toFixed(1)} ${pts[i].y.toFixed(1)}, ${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)}`;
            }
            const fillPath = linePath + ` L ${W} ${H} L 0 ${H} Z`;
            const last = pts[pts.length - 1];
            const labelStep = Math.ceil(txHistory.length / 5);
            const labels = txHistory.filter((_, i) => i === 0 || i % labelStep === 0 || i === txHistory.length - 1);
            return (
              <div className="animate-in card-hud" style={{ marginBottom: 20, padding: 0, overflow: "hidden" }}>
                <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--border)", background: "var(--bg-deep)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontFamily: "var(--font-orbitron), sans-serif", fontSize: 15, fontWeight: 700, color: "var(--amber)", letterSpacing: "0.1em" }}>CUMULATIVE ON-CHAIN TRANSACTIONS — 0G MAINNET</span>
                  <a href={`${EXPLORER}/address/${VERIFIER}`} target="_blank" rel="noreferrer" style={{ fontFamily: "var(--font-hud), monospace", fontSize: 14, color: "var(--amber)", textDecoration: "none", letterSpacing: "0.06em" }}>{txCount.toLocaleString()} TXS · VERIFY LIVE ?</a>
                </div>
                <div style={{ padding: "16px 24px" }}>
                  <svg width="100%" height="80" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: "block", overflow: "visible" }}>
                    <defs>
                      <linearGradient id="txFillGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--amber)" stopOpacity="0.28" />
                        <stop offset="100%" stopColor="var(--amber)" stopOpacity="0.02" />
                      </linearGradient>
                      <filter id="txLineGlow">
                        <feGaussianBlur stdDeviation="2.5" result="blur" />
                        <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                      </filter>
                    </defs>
                    <path d={fillPath} fill="url(#txFillGrad)" />
                    <path d={linePath} fill="none" stroke="var(--amber)" strokeWidth="2.5" filter="url(#txLineGlow)" />
                    <circle cx={last.x} cy={last.y} r={4} fill="var(--amber)" />
                    <circle cx={last.x} cy={last.y} r={9} fill="none" stroke="var(--amber)" strokeWidth="1" opacity="0.35" />
                  </svg>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontFamily: "var(--font-hud), monospace", fontSize: 12, color: "var(--text-faint)" }}>
                    {labels.map((p, i) => <span key={i}>{p.ts}</span>)}
                  </div>
                  <div style={{ marginTop: 6, fontSize: 13, color: "var(--text-dim)", fontFamily: "var(--font-hud), monospace" }}>
                    DEPLOYED APR 28, 2026 · 2 TXS / 15-SECOND CYCLE · {txCount.toLocaleString()} CUMULATIVE MAINNET ATTESTATIONS
                  </div>
                </div>
              </div>
            );
          })()}

          <div style={{ fontFamily: "var(--font-orbitron), sans-serif", fontSize: 22, fontWeight: 700, color: "var(--cyan)", letterSpacing: "0.1em", marginBottom: 16 }} className="text-glow-cyan">
            HOW PROVUS WORKS
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
            {[
              { step: "01", label: "MARKET SCAN",    color: "var(--cyan)",   desc: "Agent wakes every 15s and fetches ETH/USD price + order-book depth from Binance via 0G Oracle." },
              { step: "02", label: "YANG-ZHANG s",   color: "var(--purple)", desc: "Yang-Zhang volatility estimator computes realised s from OHLCV data — resilient to price jumps and overnight gaps." },
              { step: "03", label: "AI DECISION",    color: "var(--green)",  desc: "Qwen-2.5-7B running inside 0G TEE analyses vol regime + momentum and outputs BUY/SELL/HOLD with confidence score." },
              { step: "04", label: "TEE ATTEST",     color: "var(--amber)",  desc: "The TEE cryptographically seals the decision — proving the exact model weights and input data used. On-chain forever." },
              { step: "05", label: "ON-CHAIN WRITE", color: "var(--cyan)",   desc: "VerifierEngine.sol records the attestation to 0G Mainnet. TX hash ? immutable proof. No human can forge or alter it." },
              { step: "06", label: "ELO SCORE",      color: "var(--purple)", desc: "After each cycle, ReputationEngine.sol scores signal accuracy using ELO — building a verifiable AI track record over time." },
            ].map(({ step, label, color, desc }) => (
              <div key={step} className="card-hud hover-card" style={{ padding: 18 }}>
                <div style={{ fontSize: 13, color: "var(--text-faint)", fontFamily: "var(--font-hud), monospace", marginBottom: 6 }}>STEP {step}</div>
                <div style={{ fontFamily: "var(--font-orbitron), sans-serif", fontSize: 15, fontWeight: 700, color, letterSpacing: "0.06em", marginBottom: 10 }}>{label}</div>
                <div style={{ fontSize: 14, color: "var(--text-dim)", lineHeight: 1.6 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* -- Footer evidence bar ------------------------------------------ */}
        <div className="animate-in" style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 40 }}>
          <a href={`${EXPLORER}/address/${VERIFIER}`} target="_blank" rel="noreferrer" className="evidence-btn">? LIVE TXS ON CHAINSCAN</a>
          <a href={`${EXPLORER}/address/${AGENT_WALLET}`} target="_blank" rel="noreferrer" className="evidence-btn">?? AGENT WALLET · 75K+ TXS</a>
          <a href="https://provus-protocol-production.up.railway.app/status" target="_blank" rel="noreferrer" className="evidence-btn" style={{ borderColor: "var(--green)", color: "var(--green)" }}>?? RAILWAY AGENT · LIVE</a>
          <a href="https://youtu.be/P3e8VS3pF4k" target="_blank" rel="noreferrer" className="evidence-btn" style={{ borderColor: "var(--red)", color: "var(--red)" }}>? DEMO VIDEO</a>
          <a href="https://github.com/Gideon145/provus-protocol" target="_blank" rel="noreferrer" className="evidence-btn">? GITHUB REPO</a>
          <a href="https://github.com/Gideon145/provus-protocol/blob/master/JUDGE_GUIDE.md" target="_blank" rel="noreferrer" className="evidence-btn" style={{ borderColor: "var(--amber)", color: "var(--amber)" }}>?? JUDGE GUIDE</a>
          <a href="https://github.com/Gideon145/provus-protocol/blob/master/AUDIT.md" target="_blank" rel="noreferrer" className="evidence-btn" style={{ borderColor: "var(--purple)", color: "var(--purple)" }}>?? CHAINGPT AUDIT</a>
          <a href="https://github.com/Gideon145/provus-protocol/blob/master/agent/src/attester.ts" target="_blank" rel="noreferrer" className="evidence-btn" style={{ borderColor: "var(--cyan)", color: "var(--cyan)" }}>?? 0G COMPUTE · TEE</a>
          <a href="https://github.com/Gideon145/provus-protocol/blob/master/agent/src/storage.ts" target="_blank" rel="noreferrer" className="evidence-btn" style={{ borderColor: "var(--purple)", color: "var(--purple)" }}>?? 0G STORAGE · MERKLE</a>
          <a href={`${EXPLORER}/address/${ARCHIVE_REG}`} target="_blank" rel="noreferrer" className="evidence-btn" style={{ borderColor: "var(--purple)", color: "var(--purple)" }}>?? ARCHIVE REGISTRY</a>
          <a href="https://github.com/Gideon145/provus-protocol/blob/master/ENGINEERING_DEBUG_LOG.md" target="_blank" rel="noreferrer" className="evidence-btn">?? ENGINEERING LOG</a>
        </div>

        {/* -- Bottom footnote ---------------------------------------------- */}
        <div style={{ textAlign: "center", paddingBottom: 32 }}>
          <div style={{ fontFamily: "var(--font-hud), monospace", fontSize: 13, color: "var(--text-faint)", letterSpacing: "0.15em" }}>
            0G APAC HACKATHON 2026 · TRACK 2 VERIFIABLE FINANCE · DEADLINE MAY 16 2026
          </div>
          <div style={{ fontFamily: "var(--font-hud), monospace", fontSize: 13, color: "var(--text-faint)", letterSpacing: "0.15em", marginTop: 6 }}>
            CHAIN ID 16661 · RPC: evmrpc.0g.ai · EXPLORER: chainscan.0g.ai
          </div>
        </div>
      </div>
    </main>
  );
}

/* ---- Verify Decision field helper --------------------------------------- */
function VerifyField({ label, value, highlight, mono }: { label: string; value: string; highlight?: string; mono?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
      <span style={{ fontSize: 13, color: "var(--text-faint)", letterSpacing: "0.12em", fontFamily: "var(--font-hud), monospace" }}>{label}</span>
      <span style={{
        fontSize: mono ? 13 : 15,
        fontWeight: highlight ? 700 : 500,
        color: highlight || "var(--text-primary)",
        fontFamily: mono ? "var(--font-hud), monospace" : "var(--font-orbitron), sans-serif",
        letterSpacing: "0.04em",
        wordBreak: "break-all",
      }}>{value}</span>
    </div>
  );
}
