import { NextResponse } from 'next/server';

const AGENT_WALLET = '0x94A4365E6B7E79791258A3Fa071824BC2b75a394';
const ZG_RPC = 'https://evmrpc.0g.ai';

export async function GET() {
  try {
    const res = await fetch(ZG_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getTransactionCount',
        params: [AGENT_WALLET, 'latest'],
        id: 1,
      }),
      next: { revalidate: 15 },
    });
    const data = await res.json();
    const txCount = parseInt(data.result, 16);
    return NextResponse.json({ txCount, iteration: Math.floor(txCount / 2) });
  } catch {
    return NextResponse.json({ txCount: null, iteration: null }, { status: 500 });
  }
}
