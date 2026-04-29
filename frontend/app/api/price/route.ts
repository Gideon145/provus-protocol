import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const res = await fetch('https://api.binance.com/api/v3/ticker/24hr?symbol=ETHUSDT', {
      next: { revalidate: 30 },
    });
    const data = await res.json();
    return NextResponse.json({
      price: parseFloat(data.lastPrice),
      change: parseFloat(data.priceChangePercent),
    });
  } catch {
    return NextResponse.json({ price: null, change: null }, { status: 500 });
  }
}
