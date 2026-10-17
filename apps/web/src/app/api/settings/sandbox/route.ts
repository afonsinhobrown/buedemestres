import { NextResponse } from 'next/server';
import { getSandboxSettings } from '@/lib/sandbox';

export const dynamic = 'force-dynamic';

export async function GET() {
  const settings = await getSandboxSettings();
  return NextResponse.json({ ok: true, ...settings });
}
