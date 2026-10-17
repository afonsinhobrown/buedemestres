import { NextResponse } from 'next/server';
import { verifyPaySuiteWebhookSignature, REF_PREFIX } from '@/lib/paysuite';
import { confirmJobPaymentByReference, failJobPaymentByReference } from '@/lib/job-payment';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function isPaid(event: string, status: string): boolean {
  return (
    event === 'payment.success' ||
    event === 'payment.succeeded' ||
    event === 'payment.paid' ||
    ['paid', 'succeeded', 'completed', 'confirmed'].includes(status)
  );
}

function isFailed(event: string, status: string): boolean {
  return (
    event === 'payment.failed' ||
    event === 'payment.cancelled' ||
    event === 'payment.canceled' ||
    event === 'payment.expired' ||
    ['failed', 'falhou', 'cancelled', 'canceled', 'expired', 'declined', 'rejected'].includes(status)
  );
}

export async function POST(req: Request) {
  const raw = await req.text();
  const signature = req.headers.get('x-signature');

  if (!verifyPaySuiteWebhookSignature(raw, signature)) {
    return NextResponse.json({ received: true, error: 'invalid signature' }, { status: 400 });
  }

  let body: { event?: string; data?: { reference?: string; status?: string } };
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ received: true, error: 'invalid json' }, { status: 400 });
  }

  const event = body.event ?? '';
  const reference = body.data?.reference;
  const status = String(body.data?.status ?? '').toLowerCase();

  if (!reference || !reference.startsWith(REF_PREFIX)) {
    return NextResponse.json({ received: true, ignored: true });
  }

  try {
    if (isPaid(event, status)) {
      const result = await confirmJobPaymentByReference(reference);
      return NextResponse.json({ received: true, result });
    }
    if (isFailed(event, status)) {
      const result = await failJobPaymentByReference(reference);
      return NextResponse.json({ received: true, result });
    }
    return NextResponse.json({ received: true, ignored: event || status });
  } catch (error) {
    console.error('[webhooks/paysuite]', error);
    return NextResponse.json({ received: false }, { status: 500 });
  }
}
