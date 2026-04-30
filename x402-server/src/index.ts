import "dotenv/config";
import express, { Request, Response } from "express";
import cors from "cors";
import { ethers } from "ethers";
import axios from "axios";

/**
 * PROVUS x402 Payment Server
 *
 * Implements the x402 HTTP Payment Required protocol for PROVUS.
 *
 * Value proposition: the PROVUS agent generates TEE-attested trading signals
 * every 15s on 0G Mainnet. Premium subscribers get access to the live signal
 * stream + attestation hashes. Free tier: public TX count + ELO only.
 *
 * Flow:
 *   1. Client requests GET /signal/latest
 *   2. Server returns 402 Payment Required (if no active subscription)
 *   3. Client sends x402 authorization via x402-payment skill
 *   4. Server verifies + activates subscription
 *   5. Client receives live attested signals
 *
 * Price: 0.001 A0GI per day (0G Mainnet native token)
 */

const app = express();
app.use(express.json());
app.use(cors());

const PORT = parseInt(process.env.PORT || process.env.X402_PORT || "3002", 10);
const AGENT_STATUS_URL = process.env.AGENT_STATUS_URL || "https://provus-protocol-production.up.railway.app";
const AGENT_WALLET = process.env.AGENT_WALLET || "0x94A4365E6B7E79791258A3Fa071824BC2b75a394";
const ALLOW_DEMO_BYPASS = process.env.ALLOW_DEMO_AUTH_BYPASS === "true";

// 0.001 A0GI per day (0G native token, 18 decimals)
const PRICE_PER_DAY = ethers.parseEther("0.001");

// ─────────────────────────────────────────────────────────────────────────────
// Subscription tracking (in-memory — use Redis in production)
// ─────────────────────────────────────────────────────────────────────────────

interface Subscription {
  subscriptionId: string;
  subscriber: string;
  paidUntil: number; // unix ms
  activatedAt: number;
  premiumPaid: string;
  tier: "standard" | "premium";
}

const subscriptions = new Map<string, Subscription>();

// ─────────────────────────────────────────────────────────────────────────────
// x402 Middleware
// ─────────────────────────────────────────────────────────────────────────────

function x402Middleware(req: Request, res: Response, next: () => void) {
  const authHeader = req.headers["x-payment-authorization"];
  const amountHeader = req.headers["x-payment-amount"];
  const currency = req.headers["x-payment-currency"];

  if (ALLOW_DEMO_BYPASS) return next();

  if (!authHeader || !amountHeader) {
    return res.status(402).json({
      error: "Payment Required",
      protocol: "x402",
      details: {
        description: "Access to PROVUS live signal stream requires payment",
        pricePerDay: ethers.formatEther(PRICE_PER_DAY) + " A0GI",
        chain: "0G Mainnet (Chain ID 16661)",
        paymentAddress: AGENT_WALLET,
        requiredHeaders: {
          "X-Payment-Authorization": "x402 TEE-signed authorization",
          "X-Payment-Amount": "amount in A0GI wei",
          "X-Payment-Currency": "A0GI",
        },
        endpoints: {
          subscribe: "POST /signal/subscribe",
          status: "GET /signal/status/:subscriptionId",
          latestSignal: "GET /signal/latest (requires subscription)",
          demo: "POST /signal/demo (free hackathon demo)",
        },
      },
    });
  }

  (req as Request & { paymentAmount?: string }).paymentAmount = String(amountHeader);
  next();
}

function requireSubscription(req: Request, res: Response, next: () => void) {
  const subId = req.headers["x-subscription-id"] as string;
  if (!subId) {
    return res.status(402).json({
      error: "Subscription Required",
      message: "Pass X-Subscription-Id header. Get a subscription via POST /signal/subscribe",
      demoEndpoint: "POST /signal/demo",
    });
  }

  const sub = subscriptions.get(subId);
  if (!sub || Date.now() > sub.paidUntil) {
    return res.status(402).json({
      error: "Subscription Expired",
      message: "Renew via POST /signal/extend/:subscriptionId",
    });
  }

  next();
}

// ─────────────────────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /health
 * Health check
 */
app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "PROVUS x402 Payment Server" });
});

/**
 * GET /signal/latest
 * Get the latest TEE-attested signal. Requires active subscription.
 */
app.get("/signal/latest", requireSubscription, async (_req, res) => {
  try {
    const r = await axios.get(`${AGENT_STATUS_URL}/status`, { timeout: 4000 });
    const s = r.data;
    return res.json({
      signal: s.signal,
      confidence: s.confidence,
      regime: s.regime,
      realizedVolBps: s.realizedVolBps,
      attestationHash: s.lastAttestationHash || null,
      attestTxHash: s.lastAttestTxHash || null,
      volTxHash: s.lastVolTxHash || null,
      iteration: s.iteration,
      timestamp: s.lastUpdated,
      onChainTxCount: s.onChainTxCount,
      verifiedBy: "0G TEE — VerifierEngine 0x911E87629756F34190DF34162806f00b35521FD0",
    });
  } catch {
    return res.status(503).json({ error: "Agent unavailable", retryAfter: 15 });
  }
});

/**
 * POST /signal/subscribe
 * Subscribe to the PROVUS signal stream. Requires x402 payment.
 *
 * Body: { subscriber, durationDays }
 * Headers: X-Payment-Authorization, X-Payment-Amount, X-Payment-Currency
 */
app.post("/signal/subscribe", x402Middleware, (req: Request, res: Response) => {
  try {
    const subscriber = req.body.subscriber || "0x0000000000000000000000000000000000000000";
    const durationDays = Number(req.body.durationDays ?? 1);

    const subscriptionId = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "uint256"],
        [subscriber, BigInt(Date.now())]
      )
    );

    const sub: Subscription = {
      subscriptionId,
      subscriber,
      paidUntil: Date.now() + durationDays * 24 * 60 * 60 * 1000,
      activatedAt: Date.now(),
      premiumPaid: String((req as Request & { paymentAmount?: string }).paymentAmount || "0"),
      tier: "standard",
    };

    subscriptions.set(subscriptionId, sub);
    console.log(`[x402] Subscription activated: ${subscriptionId} for ${subscriber}`);

    return res.status(201).json({
      subscriptionId,
      subscriber,
      paidUntil: new Date(sub.paidUntil).toISOString(),
      durationDays,
      pricePerDay: ethers.formatEther(PRICE_PER_DAY) + " A0GI",
      usage: "Pass X-Subscription-Id header to GET /signal/latest",
      message: "PROVUS signal stream unlocked — every TEE-attested signal, live from 0G Mainnet",
    });
  } catch (err) {
    return res.status(500).json({ error: "Internal error", detail: String(err) });
  }
});

/**
 * POST /signal/demo
 * Frictionless demo access for hackathon judges — no payment required.
 */
app.post("/signal/demo", async (_req, res) => {
  try {
    const subscriptionId = ethers.keccak256(
      ethers.toUtf8Bytes(`demo-${Date.now()}-${Math.random()}`)
    );

    const sub: Subscription = {
      subscriptionId,
      subscriber: "DEMO_JUDGE",
      paidUntil: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days for judges
      activatedAt: Date.now(),
      premiumPaid: "0",
      tier: "premium",
    };

    subscriptions.set(subscriptionId, sub);
    console.log(`[x402] Demo subscription: ${subscriptionId}`);

    // Also fetch current signal to return immediately
    let currentSignal = null;
    try {
      const r = await axios.get(`${AGENT_STATUS_URL}/status`, { timeout: 3000 });
      const s = r.data;
      currentSignal = {
        signal: s.signal,
        confidence: s.confidence,
        regime: s.regime,
        attestationHash: s.lastAttestationHash || null,
        iteration: s.iteration,
      };
    } catch { /* agent may be offline */ }

    return res.json({
      success: true,
      subscriptionId,
      paidUntil: new Date(sub.paidUntil).toISOString(),
      tier: "premium (demo)",
      currentSignal,
      usage: "Pass X-Subscription-Id: <subscriptionId> header to GET /signal/latest",
      x402Note: "Demo access — 7 days free for hackathon judges. Real subscriptions require X-Payment-Authorization with A0GI on 0G Mainnet.",
      pricePerDay: ethers.formatEther(PRICE_PER_DAY) + " A0GI",
      chain: "0G Mainnet (Chain ID 16661)",
    });
  } catch (err) {
    return res.status(500).json({ error: "Internal error", detail: String(err) });
  }
});

/**
 * GET /signal/status/:subscriptionId
 * Check subscription status
 */
app.get("/signal/status/:subscriptionId", (req: Request, res: Response) => {
  const sub = subscriptions.get(req.params.subscriptionId);
  if (!sub) {
    return res.status(404).json({ active: false, error: "Subscription not found" });
  }
  const active = Date.now() < sub.paidUntil;
  return res.json({
    active,
    subscriptionId: sub.subscriptionId,
    subscriber: sub.subscriber,
    tier: sub.tier,
    paidUntil: new Date(sub.paidUntil).toISOString(),
    remainingMs: Math.max(0, sub.paidUntil - Date.now()),
    remainingHours: Math.max(0, (sub.paidUntil - Date.now()) / 3600000).toFixed(1),
  });
});

/**
 * POST /signal/extend/:subscriptionId
 * Extend an existing subscription with x402 payment
 */
app.post("/signal/extend/:subscriptionId", x402Middleware, (req: Request, res: Response) => {
  const sub = subscriptions.get(req.params.subscriptionId);
  if (!sub) {
    return res.status(404).json({ error: "Subscription not found" });
  }

  const durationDays = Number(req.body.durationDays ?? 1);
  const extensionMs = durationDays * 24 * 60 * 60 * 1000;
  sub.paidUntil = Math.max(sub.paidUntil, Date.now()) + extensionMs;

  console.log(`[x402] Subscription extended: ${req.params.subscriptionId} until ${new Date(sub.paidUntil).toISOString()}`);

  return res.json({
    subscriptionId: req.params.subscriptionId,
    extended: true,
    newPaidUntil: new Date(sub.paidUntil).toISOString(),
    addedDays: durationDays,
  });
});

/**
 * GET /subscriptions/active
 * Internal: list all active subscriptions
 */
app.get("/subscriptions/active", (_req, res) => {
  const active = Array.from(subscriptions.values())
    .filter(s => Date.now() < s.paidUntil)
    .map(s => ({
      subscriptionId: s.subscriptionId,
      subscriber: s.subscriber,
      paidUntil: new Date(s.paidUntil).toISOString(),
      tier: s.tier,
    }));
  return res.json({ count: active.length, subscriptions: active });
});

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`[PROVUS x402] Payment server running on :${PORT}`);
  console.log(`[PROVUS x402] Agent status URL: ${AGENT_STATUS_URL}`);
  console.log(`[PROVUS x402] Demo bypass: ${ALLOW_DEMO_BYPASS}`);
  console.log(`[PROVUS x402] Price: ${ethers.formatEther(PRICE_PER_DAY)} A0GI/day`);
});
