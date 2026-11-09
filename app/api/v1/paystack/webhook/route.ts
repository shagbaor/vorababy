import { NextResponse } from 'next/server'
import { finalizePayment } from '@/lib/server/payments'
import { validWebhookSignature, type Transaction } from '@/lib/server/paystack'
import { settleWithdrawal } from '@/lib/server/withdrawals'

export const dynamic = 'force-dynamic'

// Paystack calls this for every payment and transfer event. Set it in the
// Paystack dashboard: Settings → API Keys & Webhooks → Webhook URL =
// https://vorapicks.com/api/v1/paystack/webhook
export async function POST(request: Request) {
  const raw = await request.text()
  if (!validWebhookSignature(raw, request.headers.get('x-paystack-signature'))) {
    return NextResponse.json({ success: false, message: 'Invalid signature' }, { status: 401 })
  }
  const event = JSON.parse(raw) as { event: string; data: Record<string, unknown> }
  try {
    if (event.event === 'charge.success') {
      await finalizePayment(String(event.data.reference), event.data as unknown as Transaction)
    } else if (['transfer.success', 'transfer.failed', 'transfer.reversed'].includes(event.event)) {
      await settleWithdrawal(String(event.data.reference), event.event.split('.')[1] as 'success' | 'failed' | 'reversed')
    }
  } catch (error) {
    // A non-2xx makes Paystack retry later.
    console.error(`Paystack webhook ${event.event} failed`, error)
    return NextResponse.json({ success: false, message: 'Not processed' }, { status: 500 })
  }
  return NextResponse.json({ success: true, message: 'Received' })
}
