/**
 * attester.ts
 *
 * PROVUS — 0G Compute attester.
 *
 * Wraps the ZGComputeNetworkBroker to:
 *   1. Query DeepSeek V3.1 (or other 0G provider) with a trading signal prompt
 *   2. Verify the TEE attestation via processResponse → isValid
 *   3. Build the attestationHash for on-chain storage in VerifierEngine
 *
 * Usage:
 *   const attester = new ZGAttester(wallet);
 *   await attester.init();
 *   const result = await attester.queryAndAttest(prompt);
 *   // result.isValid === true → call VerifierEngine.attest()
 */

import { createZGComputeNetworkBroker } from "@0glabs/0g-serving-broker";
import { ethers } from "ethers";
import OpenAI from "openai";
import { logger } from "./logger";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AttestationResult {
  chatId: string;
  content: string;
  isValid: boolean | null;
  attestationHash: string; // bytes32 ready for VerifierEngine
  signal: "BUY" | "SELL" | "HOLD";
  confidence: number;      // 0–100 (int, for on-chain storage)
  confidenceFloat: number; // 0.0–1.0 (raw from model)
  reasoning: string;
  providerAddress: string;
}

// ─── ZGAttester ───────────────────────────────────────────────────────────────

export class ZGAttester {
  private broker: Awaited<ReturnType<typeof createZGComputeNetworkBroker>> | null = null;
  private wallet: ethers.Wallet;
  private providerAddress: string;
  private initialized = false;

  constructor(wallet: ethers.Wallet, providerAddress?: string) {
    this.wallet = wallet;
    this.providerAddress =
      providerAddress ??
      process.env.ZG_DEEPSEEK_PROVIDER ??
      "0xd9966e13a6026Fcca4b13E7ff95c94DE268C471C";
  }

  // ─── Init ──────────────────────────────────────────────────────────────────

  async init(): Promise<void> {
    if (this.initialized) return;

    logger.info("Initializing 0G Compute broker...");
    this.broker = await createZGComputeNetworkBroker(this.wallet);

    // Ensure ledger exists
    try {
      await this.broker.ledger.getLedger();
      logger.success("0G ledger found.");
    } catch {
      logger.info("No ledger — creating with 3 OG...");
      await this.broker!.ledger.addLedger(3);
      logger.success("0G ledger created.");
    }

    // Acknowledge provider signer
    try {
      await this.broker!.inference.acknowledgeProviderSigner(this.providerAddress);
    } catch (err) {
      logger.warn(`acknowledgeProviderSigner skipped: ${String(err).slice(0, 80)}`);
    }

    this.initialized = true;
    logger.success("ZGAttester ready.");
  }

  // ─── Query + Attest ────────────────────────────────────────────────────────

  /**
   * Send a prompt to the 0G Compute provider and verify the TEE attestation.
   * Returns full attestation result including the signal, confidence, and
   * the bytes32 attestationHash ready for VerifierEngine.attest().
   */
  async queryAndAttest(prompt: string): Promise<AttestationResult> {
    if (!this.initialized) await this.init();
    const broker = this.broker!;

    // Get service endpoint and model from provider metadata
    const { endpoint, model } =
      await broker.inference.requestProcessor.getServiceMetadata(this.providerAddress);

    // Build request headers (includes TEE proof nonce)
    const headers = await broker.inference.requestProcessor.getRequestHeaders(
      this.providerAddress,
      prompt
    );

    // Call model via OpenAI-compatible API
    const openai = new OpenAI({
      baseURL: endpoint,
      apiKey: "",
      defaultHeaders: headers as unknown as Record<string, string>,
    });

    const response = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content:
            'You are a DeFi trading signal generator. Respond with valid JSON only. ' +
            'Format: {"signal":"BUY"|"SELL"|"HOLD","confidence":0.0-1.0,"reasoning":"string"}',
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.3, // low temperature for more consistent signals
    });

    const content = response.choices[0].message.content ?? "{}";
    const chatId = response.id;

    logger.attest(`chatId=${chatId.slice(0, 16)}... model=${model}`);

    // Verify TEE attestation — processResponse returns true/false/null
    const isValid = await broker.inference.responseProcessor.processResponse(
      this.providerAddress,
      chatId,
      content
    );

    logger.attest(`isValid=${isValid}`);

    // Parse signal from model response
    const { signal, confidenceFloat, reasoning } = this._parseSignal(content);
    const confidence = Math.round(confidenceFloat * 100); // scale to 0–100 for on-chain

    // Build bytes32 attestationHash for VerifierEngine (replay protection)
    const attestationHash = ethers.keccak256(
      ethers.toUtf8Bytes(
        JSON.stringify({ chatId, content, isValid, provider: this.providerAddress })
      )
    );

    return {
      chatId,
      content,
      isValid,
      attestationHash,
      signal,
      confidence,
      confidenceFloat,
      reasoning,
      providerAddress: this.providerAddress,
    };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private _parseSignal(json: string): {
    signal: "BUY" | "SELL" | "HOLD";
    confidenceFloat: number;
    reasoning: string;
  } {
    try {
      const p = JSON.parse(json);
      const raw = String(p.signal ?? "HOLD").toUpperCase();
      const signal: "BUY" | "SELL" | "HOLD" =
        raw === "BUY" ? "BUY" : raw === "SELL" ? "SELL" : "HOLD";
      return {
        signal,
        confidenceFloat: Math.min(1, Math.max(0, Number(p.confidence ?? 0.5))),
        reasoning: String(p.reasoning ?? ""),
      };
    } catch {
      logger.warn("Failed to parse AI signal JSON — defaulting to HOLD");
      return { signal: "HOLD", confidenceFloat: 0.5, reasoning: json };
    }
  }
}
