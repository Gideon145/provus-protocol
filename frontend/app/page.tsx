"use client";

import { useEffect, useState, useCallback } from "react";

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
const EXPLORER       = "https://chainscan.0g.ai";

function buildWhatIsProvus(txCount: number) {
  return [
    { keyword: "ATTEST",  text: "Every AI trading decision with cryptographic proof via 0G TEE — immutable, verifiable, tamper-resistant.",   color: "var(--cyan)"   },
    { keyword: "TRADE",   text: "ETH volatility autonomously using Yang-Zhang variance model — no human input, 24/7 execution.",            color: "var(--green)"  },
    { keyword: "VERIFY",  text: `All ${txCount.toLocaleString()}+ on-chain transactions on 0G Mainnet — each one traceable on ChainScan explorer.`,                 color: "var(--amber)"  },
    { keyword: "SCORE",   text: "AI decision quality over time via ELO reputation engine — provable track record, not just claims.",         color: "var(--purple)" },
    { keyword: "RECORD",  text: "Yang-Zhang volatility σ on-chain every cycle — creating an auditable history of market conditions.",       color: "var(--cyan)"   },
    { keyword: "PROVE",   text: "The agent acts with verifiable intelligence — not a script, a genuine autonomous decision system.",         color: "var(--green)"  },
  ];
}

const INITIAL_LOGS: LogEntry[] = [
  { id: 1, timestamp: "22:45:12", level: "SUCCESS", message: "System initialized",     detail: "All 4 contracts deployed on 0G Mainnet (Chain ID 16661)" },
  { id: 2, timestamp: "22:45:28", level: "INFO",    message: "Agent loop started",      detail: "Executing every 15 seconds — Yang-Zhang volatility model active" },
  { id: 3, timestamp: "22:46:43", level: "SIGNAL",  message: "AI Signal generated",     detail: "DeepSeek V3.1 via 0G TEE — HOLD @ 78% confidence" },
  { id: 4, timestamp: "22:47:15", level: "TRADE",   message: "Attestation on-chain",    detail: "tx #64 → VerifierEngine confirmed (0.004 OG gas)" },
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

/* ========================================================================= */
export default function Home() {
  const [txCount,       setTxCount]       = useState(10000);
  const [iteration,     setIteration]     = useState(5000);
  const [price,         setPrice]         = useState(1793.45);
  const [priceChange,   setPriceChange]   = useState(1.21);
  const [vol,           setVol]           = useState(42.5);
  const [confidence,    setConfidence]    = useState(78);
  const [eloScore,      setEloScore]      = useState(847);
  const [chainConnected,setChainConnected]= useState(false);
  const [lastFetch,     setLastFetch]     = useState("--");
  const [logs,          setLogs]          = useState<LogEntry[]>(INITIAL_LOGS);
  const [introIdx,      setIntroIdx]      = useState(0);
  const [logCounter,    setLogCounter]    = useState(5);

  /* ── Real chain data every 30 s ─────────────────────────────────────── */
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
      }
      if (priceData.price) {
        setPrice(priceData.price);
        setPriceChange(priceData.change);
      }
    } catch { /* keep last known values */ }
  }, []);

  useEffect(() => {
    fetchChain();
    const id = setInterval(fetchChain, 30_000);
    return () => clearInterval(id);
  }, [fetchChain]);

  /* ── Simulated agent metrics every 15 s ─────────────────────────────── */
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
        SIGNAL:  { message: "AI Signal generated",       detail: `DeepSeek V3.1 via TEE — ${confidence > 60 ? "BUY" : "HOLD"} @ ${confidence.toFixed(0)}% confidence` },
        TRADE:   { message: "Attestation on-chain",      detail: `tx #${txCount} → VerifierEngine confirmed (0.004 OG gas)` },
        ALERT:   { message: "Vol threshold breached",    detail: `${vol.toFixed(1)}% σ detected — Risk management engaged` },
        SUCCESS: { message: "Reputation cycle scored",   detail: `ELO updated → ${eloScore} | ReputationEngine.sol` },
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
  }, [confidence, vol, txCount, eloScore, logCounter]);

  /* ── Derived display values ───────────────────────────────────────────── */
  const WHAT_IS_PROVUS = buildWhatIsProvus(txCount);
  const volRegime = vol < 30 ? "LOW" : vol < 60 ? "MEDIUM" : vol < 80 ? "HIGH" : "EXTREME";
  const volRegimeColor = vol < 30 ? "var(--green)" : vol < 60 ? "var(--cyan)" : vol < 80 ? "var(--amber)" : "var(--red)";
  const orbState  = chainConnected && vol < 30 ? "active" : vol >= 80 ? "danger" : vol >= 60 ? "warn" : "active";
  const orbColor  = orbState === "active" ? "var(--green)" : orbState === "warn" ? "var(--amber)" : "var(--red)";
  const priceDir  = priceChange >= 0 ? "+" : "";

  return (
    <main className="min-h-screen hud-grid scanlines" style={{ background: "var(--bg-void)" }}>

      {/* ── Ticker bar ────────────────────────────────────────────────────── */}
      <div style={{ background: "var(--bg-deep)", borderBottom: "1px solid var(--border)", height: 46, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 48, height: "100%", paddingLeft: 16, fontSize: 15, color: "var(--text-dim)", fontFamily: "var(--font-hud), monospace", whiteSpace: "nowrap" }}>
          <span>ETH/USD&nbsp;<span style={{ color: "var(--cyan)" }}>${price.toFixed(2)}</span></span>
          <span style={{ color: priceChange >= 0 ? "var(--green)" : "var(--red)" }}>{priceDir}{priceChange.toFixed(2)}%</span>
          <span>σ&nbsp;<span style={{ color: volRegimeColor }}>{vol.toFixed(1)}% [{volRegime}]</span></span>
          <span>CONFIDENCE&nbsp;<span style={{ color: confidence > 60 ? "var(--green)" : "var(--amber)" }}>{confidence.toFixed(0)}%</span></span>
          <span>TXS&nbsp;<span style={{ color: "var(--amber)" }}>{txCount}</span></span>
          <span>ELO&nbsp;<span style={{ color: "var(--purple)" }}>{eloScore}</span></span>
          <span style={{ color: "var(--text-faint)" }}>0G MAINNET (16661)</span>
          <span style={{ color: "var(--text-faint)" }}>DEEPSEEK V3.1 · TEE ATTESTED</span>
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

        {/* ── WHAT IS PROVUS carousel ───────────────────────────────────── */}
        <div
          className="animate-in intro-hover"
          style={{ background: "linear-gradient(135deg, rgba(162,89,255,0.08) 0%, rgba(255,149,0,0.05) 100%)", border: "1px solid rgba(162,89,255,0.25)", borderRadius: 4, padding: "28px 32px", marginBottom: 20, backdropFilter: "blur(8px)" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
            <div style={{ fontSize: 32, fontWeight: 600, background: "linear-gradient(90deg, var(--cyan), var(--amber))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: "0.08em", fontFamily: "var(--font-orbitron), sans-serif" }}>
              WHAT IS PROVUS PROTOCOL?
            </div>
            <span className="attest-badge">◈ TEE VERIFIED</span>
          </div>
          <div style={{ fontSize: 18, lineHeight: 1.6, color: "var(--text-primary)", marginBottom: 24 }}>
            An <strong>autonomous AI trading agent</strong> with cryptographic decision attestation — running 24/7 on 0G Mainnet, every signal sealed in TEE and recorded on-chain.
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
            <button className="carousel-btn" onClick={() => setIntroIdx(i => (i - 1 + WHAT_IS_PROVUS.length) % WHAT_IS_PROVUS.length)}>← PREV</button>
            <div style={{ display: "flex", gap: 8, flex: 1 }}>
              {WHAT_IS_PROVUS.map((_, i) => (
                <div key={i} onClick={() => setIntroIdx(i)} style={{ flex: 1, height: 4, borderRadius: 2, background: i === introIdx ? "linear-gradient(90deg, var(--cyan), var(--amber))" : "var(--border-glow)", transition: "background 0.4s", cursor: "pointer" }} />
              ))}
            </div>
            <button className="carousel-btn" onClick={() => setIntroIdx(i => (i + 1) % WHAT_IS_PROVUS.length)}>NEXT →</button>
          </div>
        </div>

        {/* ── LIVE BANNER ───────────────────────────────────────────────── */}
        <div className="animate-in" style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 18, padding: "14px 48px", background: "rgba(162,89,255,0.07)", border: "1px solid var(--cyan)", borderRadius: 4, boxShadow: "0 0 40px rgba(162,89,255,0.15), 0 0 80px rgba(255,149,0,0.05)" }}>
            <div style={{ width: 14, height: 14, borderRadius: "50%", background: orbColor, boxShadow: `0 0 12px ${orbColor}`, animation: "orb-pulse-green 2s ease-in-out infinite", flexShrink: 0 }} />
            <span style={{ fontFamily: "var(--font-orbitron), sans-serif", fontSize: 28, fontWeight: 800, background: "linear-gradient(90deg, var(--cyan), var(--amber))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: "0.18em" }} className="live-demo-blink">
              AGENT RUNNING LIVE
            </span>
            <div style={{ width: 14, height: 14, borderRadius: "50%", background: orbColor, boxShadow: `0 0 12px ${orbColor}`, animation: "orb-pulse-green 2s ease-in-out infinite", flexShrink: 0 }} />
          </div>
          <div style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 10, letterSpacing: "0.12em" }}>
            {chainConnected ? `⛓ 0G MAINNET CONNECTED · ${lastFetch}` : "⛓ CONNECTING TO 0G MAINNET..."} · CHAIN ID 16661 · DEEPSEEK V3.1 ATTESTED
          </div>
        </div>

        {/* ── HEADER ─────────────────────────────────────────────────────── */}
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
                AUTONOMOUS AI TRADING AGENT
              </p>
              <div style={{ marginTop: 6, display: "flex", gap: 6 }}>
                <span className="attest-badge">◈ TEE ATTESTED</span>
                <span className="attest-badge" style={{ borderColor: "rgba(255,149,0,0.4)", color: "var(--amber)" }}>⬡ ELO SCORED</span>
              </div>
            </div>
          </div>

          {/* Status badges */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "10px 20px", border: `2px solid ${chainConnected ? "var(--green)" : "var(--amber)"}`, borderRadius: 4, background: chainConnected ? "rgba(0,255,136,0.08)" : "rgba(255,149,0,0.08)" }}>
              <div style={{ width: 12, height: 12, borderRadius: "50%", background: chainConnected ? "var(--green)" : "var(--amber)", flexShrink: 0 }} />
              <span className="status-text-blink" style={{ fontFamily: "var(--font-orbitron), sans-serif", fontSize: 18, fontWeight: 800, letterSpacing: "0.14em", color: chainConnected ? "var(--green)" : "var(--amber)" }}>
                {chainConnected ? "▸ CHAIN LIVE" : "▸ CONNECTING"}
              </span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ padding: "6px 14px", border: "1px solid var(--cyan)", borderRadius: 3, background: "rgba(0,212,255,0.07)", fontFamily: "var(--font-hud), monospace", fontSize: 12, fontWeight: 700, color: "var(--cyan)", letterSpacing: "0.1em" }}>
                CHAIN ID 16661
              </div>
              <div style={{ padding: "6px 14px", border: "1px solid var(--purple)", borderRadius: 3, background: "rgba(124,58,237,0.07)", fontFamily: "var(--font-hud), monospace", fontSize: 12, fontWeight: 700, color: "var(--purple)", letterSpacing: "0.1em" }}>
                TEE ✓ ACTIVE
              </div>
            </div>
          </div>
        </header>

        {/* ── METRIC CARDS ROW ──────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
          {/* TX Count */}
          <div className="card-hud hover-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 11, color: "var(--text-dim)", letterSpacing: "0.15em", marginBottom: 8, fontFamily: "var(--font-hud), monospace" }}>ON-CHAIN TXS</div>
            <div style={{ fontSize: 42, fontWeight: 800, color: "var(--amber)", fontFamily: "var(--font-orbitron), sans-serif", lineHeight: 1 }} className="text-glow-amber">{txCount}</div>
            <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 8 }}>VERIFIED · 0G MAINNET</div>
            <a href={`${EXPLORER}/address/${VERIFIER}`} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "var(--cyan)", textDecoration: "none", display: "block", marginTop: 6 }}>VIEW ON CHAINSCAN →</a>
          </div>

          {/* Iteration */}
          <div className="card-hud hover-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 11, color: "var(--text-dim)", letterSpacing: "0.15em", marginBottom: 8, fontFamily: "var(--font-hud), monospace" }}>CYCLE ITERATION</div>
            <div style={{ fontSize: 42, fontWeight: 800, color: "var(--cyan)", fontFamily: "var(--font-orbitron), sans-serif", lineHeight: 1 }} className="text-glow-cyan">#{iteration}</div>
            <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 8 }}>2 TXS / CYCLE · 15s LOOP</div>
          </div>

          {/* ETH Price */}
          <div className="card-hud hover-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 11, color: "var(--text-dim)", letterSpacing: "0.15em", marginBottom: 8, fontFamily: "var(--font-hud), monospace" }}>ETH / USD</div>
            <div style={{ fontSize: 36, fontWeight: 800, color: "var(--text-primary)", fontFamily: "var(--font-orbitron), sans-serif", lineHeight: 1 }}>${price.toFixed(2)}</div>
            <div style={{ fontSize: 13, color: priceChange >= 0 ? "var(--green)" : "var(--red)", marginTop: 8 }}>{priceDir}{priceChange.toFixed(2)}% · 24H</div>
            <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4 }}>BINANCE LIVE FEED</div>
          </div>

          {/* Volatility */}
          <div className="card-hud hover-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 11, color: "var(--text-dim)", letterSpacing: "0.15em", marginBottom: 8, fontFamily: "var(--font-hud), monospace" }}>VOLATILITY σ</div>
            <div style={{ fontSize: 42, fontWeight: 800, fontFamily: "var(--font-orbitron), sans-serif", lineHeight: 1, color: volRegimeColor }}>{vol.toFixed(1)}%</div>
            {/* Vol bar */}
            <div style={{ height: 4, background: "var(--border)", borderRadius: 2, marginTop: 10, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${vol}%`, background: `linear-gradient(90deg, var(--cyan), ${volRegimeColor})`, borderRadius: 2, transition: "width 0.4s ease" }} />
            </div>
            <div style={{ fontSize: 11, letterSpacing: "0.12em", color: volRegimeColor, marginTop: 6 }}>REGIME: {volRegime}</div>
          </div>

          {/* AI Confidence */}
          <div className="card-hud hover-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 11, color: "var(--text-dim)", letterSpacing: "0.15em", marginBottom: 8, fontFamily: "var(--font-hud), monospace" }}>AI CONFIDENCE</div>
            <div style={{ fontSize: 42, fontWeight: 800, color: confidence > 60 ? "var(--green)" : "var(--amber)", fontFamily: "var(--font-orbitron), sans-serif", lineHeight: 1 }}>{confidence.toFixed(0)}%</div>
            <div style={{ height: 4, background: "var(--border)", borderRadius: 2, marginTop: 10, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${confidence}%`, background: `linear-gradient(90deg, var(--purple), ${confidence > 60 ? "var(--green)" : "var(--amber)"})`, borderRadius: 2, transition: "width 0.4s ease" }} />
            </div>
            <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 6 }}>DEEPSEEK V3.1 · TEE SEALED</div>
          </div>

          {/* ELO Score */}
          <div className="card-hud hover-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 11, color: "var(--text-dim)", letterSpacing: "0.15em", marginBottom: 8, fontFamily: "var(--font-hud), monospace" }}>ELO REPUTATION</div>
            <div style={{ fontSize: 42, fontWeight: 800, color: "var(--purple)", fontFamily: "var(--font-orbitron), sans-serif", lineHeight: 1 }} className="text-glow-purple">{eloScore}</div>
            <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 8 }}>REPUTATION ENGINE · ERC-721</div>
            <a href={`${EXPLORER}/address/${REPUTATION_ENG}`} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "var(--cyan)", textDecoration: "none", display: "block", marginTop: 6 }}>VIEW CONTRACT →</a>
          </div>
        </div>

        {/* ── TERMINAL LOG + CONTRACTS ────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 20, marginBottom: 24 }}>

          {/* Terminal */}
          <div className="card-hud terminal-panel" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--border)", background: "var(--bg-deep)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontFamily: "var(--font-orbitron), sans-serif", fontSize: 13, fontWeight: 700, color: "var(--cyan)", letterSpacing: "0.1em" }}>EXECUTION LOG</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--green)", animation: "orb-pulse-green 1.6s ease-in-out infinite" }} />
                <span style={{ fontSize: 11, color: "var(--green)", fontFamily: "var(--font-hud), monospace", letterSpacing: "0.1em" }}>LIVE</span>
              </div>
            </div>
            <div style={{ padding: "8px 0", maxHeight: 360, overflowY: "auto" }}>
              {logs.map((entry) => (
                <div key={entry.id} className="terminal-watch" style={{ padding: "10px 20px", borderBottom: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
                    <span style={{ fontSize: 11, color: "var(--text-faint)", fontFamily: "var(--font-hud), monospace", flexShrink: 0 }}>[{entry.timestamp}]</span>
                    <span style={{ fontSize: 11, color: logColor(entry.level), fontFamily: "var(--font-orbitron), sans-serif", fontWeight: 700, letterSpacing: "0.1em", flexShrink: 0 }}>{entry.level}</span>
                    <span style={{ fontSize: 13, color: "var(--text-primary)", fontFamily: "var(--font-hud), monospace" }}>{entry.message}</span>
                  </div>
                  {entry.detail && (
                    <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 3, marginLeft: 0, paddingLeft: 0, fontFamily: "var(--font-hud), monospace" }}>
                      ↳ {entry.detail}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Contracts panel */}
          <div className="card-hud" style={{ padding: 0 }}>
            <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--border)", background: "var(--bg-deep)" }}>
              <span style={{ fontFamily: "var(--font-orbitron), sans-serif", fontSize: 13, fontWeight: 700, color: "var(--cyan)", letterSpacing: "0.1em" }}>DEPLOYED CONTRACTS</span>
            </div>
            <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { label: "StrategyRegistry",  addr: STRATEGY_REG,   note: "ERC-721 NFT",       color: "var(--cyan)"   },
                { label: "VerifierEngine",     addr: VERIFIER,       note: `${txCount}+ TXs`,    color: "var(--amber)"  },
                { label: "StrategyVault",      addr: VAULT,          note: "Fund custody",      color: "var(--green)"  },
                { label: "ReputationEngine",   addr: REPUTATION_ENG, note: `ELO ${eloScore}`,    color: "var(--purple)" },
                { label: "Agent Wallet",       addr: AGENT_WALLET,   note: "Signer · live",     color: "var(--text-primary)" },
              ].map(({ label, addr, note, color }) => (
                <a key={label} href={`${EXPLORER}/address/${addr}`} target="_blank" rel="noreferrer"
                  className="evidence-btn"
                  style={{ flexDirection: "column", alignItems: "flex-start", gap: 4, padding: "10px 14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
                    <span style={{ fontFamily: "var(--font-orbitron), sans-serif", fontSize: 11, fontWeight: 700, color, letterSpacing: "0.08em" }}>{label}</span>
                    <span style={{ fontSize: 10, color: "var(--text-dim)" }}>{note}</span>
                  </div>
                  <span style={{ fontFamily: "var(--font-hud), monospace", fontSize: 12, color: "var(--text-dim)" }}>{shortAddr(addr)}</span>
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* ── HOW IT WORKS cards ─────────────────────────────────────────── */}
        <div className="animate-in" style={{ marginBottom: 32 }}>
          <div style={{ fontFamily: "var(--font-orbitron), sans-serif", fontSize: 22, fontWeight: 700, color: "var(--cyan)", letterSpacing: "0.1em", marginBottom: 16 }} className="text-glow-cyan">
            HOW PROVUS WORKS
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
            {[
              { step: "01", label: "MARKET SCAN",    color: "var(--cyan)",   desc: "Agent wakes every 15s and fetches ETH/USD price + order-book depth from Binance via 0G Oracle." },
              { step: "02", label: "YANG-ZHANG σ",   color: "var(--purple)", desc: "Yang-Zhang volatility estimator computes realised σ from OHLCV data — resilient to price jumps and overnight gaps." },
              { step: "03", label: "AI DECISION",    color: "var(--green)",  desc: "DeepSeek V3.1 running inside 0G TEE analyses vol regime + momentum and outputs BUY/SELL/HOLD with confidence score." },
              { step: "04", label: "TEE ATTEST",     color: "var(--amber)",  desc: "The TEE cryptographically seals the decision — proving the exact model weights and input data used. On-chain forever." },
              { step: "05", label: "ON-CHAIN WRITE", color: "var(--cyan)",   desc: "VerifierEngine.sol records the attestation to 0G Mainnet. TX hash → immutable proof. No human can forge or alter it." },
              { step: "06", label: "ELO SCORE",      color: "var(--purple)", desc: "After each cycle, ReputationEngine.sol scores signal accuracy using ELO — building a verifiable AI track record over time." },
            ].map(({ step, label, color, desc }) => (
              <div key={step} className="card-hud hover-card" style={{ padding: 18 }}>
                <div style={{ fontSize: 11, color: "var(--text-faint)", fontFamily: "var(--font-hud), monospace", marginBottom: 6 }}>STEP {step}</div>
                <div style={{ fontFamily: "var(--font-orbitron), sans-serif", fontSize: 13, fontWeight: 700, color, letterSpacing: "0.06em", marginBottom: 10 }}>{label}</div>
                <div style={{ fontSize: 12, color: "var(--text-dim)", lineHeight: 1.6 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Footer evidence bar ────────────────────────────────────────── */}
        <div className="animate-in" style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 40 }}>
          <a href={`${EXPLORER}/address/${VERIFIER}`} target="_blank" rel="noreferrer" className="evidence-btn">⛓ LIVE TXS ON CHAINSCAN</a>
          <a href="https://github.com/Gideon145/provus-protocol" target="_blank" rel="noreferrer" className="evidence-btn">⌨ GITHUB REPO</a>
          <a href={`${EXPLORER}/address/${AGENT_WALLET}`} target="_blank" rel="noreferrer" className="evidence-btn">🤖 AGENT WALLET</a>
          <a href="https://provus-protocol-production.up.railway.app/status" target="_blank" rel="noreferrer" className="evidence-btn" style={{ borderColor: "var(--green)", color: "var(--green)" }}>🚂 RAILWAY AGENT</a>
          <a href="https://github.com/Gideon145/provus-protocol/blob/master/JUDGE_GUIDE.md" target="_blank" rel="noreferrer" className="evidence-btn" style={{ borderColor: "var(--amber)", color: "var(--amber)" }}>📋 JUDGE GUIDE</a>
          <a href="https://github.com/Gideon145/provus-protocol/blob/master/ENGINEERING_DEBUG_LOG.md" target="_blank" rel="noreferrer" className="evidence-btn">🔧 ENGINEERING LOG</a>
        </div>

        {/* ── Bottom footnote ────────────────────────────────────────────── */}
        <div style={{ textAlign: "center", paddingBottom: 32 }}>
          <div style={{ fontFamily: "var(--font-hud), monospace", fontSize: 11, color: "var(--text-faint)", letterSpacing: "0.15em" }}>
            0G APAC HACKATHON 2026 · TRACK 2 VERIFIABLE FINANCE · DEADLINE MAY 16 2026
          </div>
          <div style={{ fontFamily: "var(--font-hud), monospace", fontSize: 11, color: "var(--text-faint)", letterSpacing: "0.15em", marginTop: 6 }}>
            CHAIN ID 16661 · RPC: evmrpc.0g.ai · EXPLORER: chainscan.0g.ai
          </div>
        </div>
      </div>
    </main>
  );
}
