/**
 * volatility.ts
 *
 * PROVUS Volatility Engine — Yang-Zhang estimator on Binance klines.
 * No external CLI dependency. Fetches directly from Binance REST API.
 *
 * Yang-Zhang: more accurate than close-to-close for intraday data.
 *   YZ = sqrt(k·σ_OC² + σ_O² + k·σ_C²)  where k = 0.34
 *
 * Used to:
 *   1. Build the context for the 0G Compute (DeepSeek) prompt
 *   2. Classify regime → inform hedge ratio
 *   3. Include in the reasoning trace uploaded to 0G Storage
 */

import https from "https";
import { logger } from "./logger";

export interface VolatilityState {
  realizedVolBps: number;       // annualized vol in bps (e.g. 4200 = 42%)
  hedgeRatio: number;           // 0.0 – 1.0 (adaptive per regime)
  regime: "LOW" | "MEDIUM" | "HIGH" | "EXTREME";
  lastUpdated: number;          // Date.now()
  sampleCount: number;
  latestPrice: number;          // last close price
  priceChange24hPct: number;    // 24h % change (from ticker)
}

const BINANCE_BASE = "https://api.binance.com";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ─── HTTP helper ─────────────────────────────────────────────────────────────

function fetchJson(url: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = "";
        res.on("data", (chunk: Buffer) => (data += chunk.toString()));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`JSON parse error: ${e}`));
          }
        });
      })
      .on("error", reject);
  });
}

// ─── VolatilityEngine ────────────────────────────────────────────────────────

export class VolatilityEngine {
  private cache = new Map<string, VolatilityState>();

  async getVolatility(symbol: string, interval = "5m", limit = 144): Promise<VolatilityState> {
    const cached = this.cache.get(symbol);
    if (cached && Date.now() - cached.lastUpdated < CACHE_TTL_MS) {
      return cached;
    }

    try {
      // Fetch klines + 24h ticker in parallel
      const [klines, ticker] = await Promise.all([
        fetchJson(
          `${BINANCE_BASE}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
        ),
        fetchJson(`${BINANCE_BASE}/api/v3/ticker/24hr?symbol=${symbol}`),
      ]);

      const state = this._computeFromKlines(klines as number[][], ticker as Record<string, string>);
      this.cache.set(symbol, state);
      return state;
    } catch (err) {
      logger.warn(`[VolEngine] Binance fetch failed for ${symbol}: ${err}`);
      return this._fallbackState();
    }
  }

  private _computeFromKlines(
    data: number[][],
    ticker: Record<string, string>
  ): VolatilityState {
    // Binance kline format: [openTime, open, high, low, close, volume, ...]
    if (!Array.isArray(data) || data.length < 10) {
      return this._fallbackState();
    }

    const candles = data.map((c) => ({
      open: Number(c[1]),
      high: Number(c[2]),
      low: Number(c[3]),
      close: Number(c[4]),
    }));

    // Yang-Zhang volatility estimator
    const n = candles.length;
    const k = 0.34; // Yang-Zhang constant

    let sumOC = 0; // overnight returns (open/prev-close)
    let sumO = 0;  // open-to-close returns
    let sumC = 0;  // close-to-close (Rogers-Satchell component)

    const logReturnsC: number[] = [];
    const logReturnsO: number[] = [];

    for (let i = 1; i < n; i++) {
      const prev = candles[i - 1];
      const curr = candles[i];

      if (prev.close > 0 && curr.open > 0 && curr.close > 0 && curr.high > 0 && curr.low > 0) {
        const oc = Math.log(curr.open / prev.close); // overnight return
        const cc = Math.log(curr.close / prev.close); // close-to-close

        logReturnsC.push(cc);
        logReturnsO.push(oc);

        // Rogers-Satchell component
        const rs =
          Math.log(curr.high / curr.close) * Math.log(curr.high / curr.open) +
          Math.log(curr.low / curr.close) * Math.log(curr.low / curr.open);
        sumC += rs;
      }
    }

    const m = logReturnsC.length;
    if (m < 5) return this._fallbackState();

    const meanC = logReturnsC.reduce((a, b) => a + b, 0) / m;
    const meanO = logReturnsO.reduce((a, b) => a + b, 0) / m;

    const varC = logReturnsC.reduce((a, b) => a + (b - meanC) ** 2, 0) / (m - 1);
    const varO = logReturnsO.reduce((a, b) => a + (b - meanO) ** 2, 0) / (m - 1);
    const sigmaRS = sumC / m;

    // Yang-Zhang = sqrt(k·varO + (1−k)·sigmaRS + varC)
    // (simplified 3-component version)
    const yzVariance = k * varO + (1 - k) * Math.max(sigmaRS, 0) + varC;
    const yzDailyVol = Math.sqrt(Math.max(yzVariance, 0));

    // Annualize: 5m × 288 = 1 day → 288 × 365 periods per year
    const periodsPerYear = (24 * 60 / parseInt("5")) * 365;
    const annualizedVol = yzDailyVol * Math.sqrt(periodsPerYear);
    const realizedVolBps = Math.round(annualizedVol * 10000);

    const { hedgeRatio, regime } = this._classifyRegime(realizedVolBps);
    const latestPrice = candles[candles.length - 1].close;
    const priceChange24hPct = ticker?.priceChangePercent
      ? parseFloat(ticker.priceChangePercent)
      : 0;

    return {
      realizedVolBps,
      hedgeRatio,
      regime,
      lastUpdated: Date.now(),
      sampleCount: m,
      latestPrice,
      priceChange24hPct,
    };
  }

  private _classifyRegime(volBps: number): {
    hedgeRatio: number;
    regime: VolatilityState["regime"];
  } {
    if (volBps < 3000) return { hedgeRatio: 0.5, regime: "LOW" };
    if (volBps < 6000) return { hedgeRatio: 0.7, regime: "MEDIUM" };
    if (volBps < 10000) return { hedgeRatio: 0.9, regime: "HIGH" };
    return { hedgeRatio: 1.0, regime: "EXTREME" };
  }

  private _fallbackState(): VolatilityState {
    return {
      realizedVolBps: 5000,
      hedgeRatio: 0.7,
      regime: "MEDIUM",
      lastUpdated: Date.now(),
      sampleCount: 0,
      latestPrice: 0,
      priceChange24hPct: 0,
    };
  }
}
