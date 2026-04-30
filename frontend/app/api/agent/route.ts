import { NextResponse } from 'next/server';

const AGENT_API =
  process.env.AGENT_API_URL ?? 'https://provus-protocol-production.up.railway.app';

export async function GET() {
  try {
    const res = await fetch(`${AGENT_API}/status`, {
      next: { revalidate: 15 },
    });
    if (!res.ok) throw new Error(`Agent returned ${res.status}`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
