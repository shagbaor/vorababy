import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { ApiError } from '@/lib/api/response'

// Thin client for the Paystack API (https://paystack.com/docs/api). The secret
// key is PAYSTACK_SECRET_KEY on the server only.

const BASE = 'https://api.paystack.co'

function secret() {
  const key = process.env.PAYSTACK_SECRET_KEY
  if (!key) throw new ApiError('internal_error', 'Payments are not set up yet')
  return key
}

type PaystackResponse<T> = { status: boolean; message: string; data: T }

// Local testing only: PAYSTACK_FAKE=1 answers without contacting Paystack.
// Ignored on Vercel, so it can never affect the live site.
const fake = process.env.PAYSTACK_FAKE === '1' && !process.env.VERCEL

function fakeCall(method: string, path: string, body: Record<string, unknown> = {}): unknown {
  const ref = (body.reference as string) ?? `fake-${Date.now()}`
  if (path.startsWith('/bank/resolve')) {
    if (path.includes('account_number=0000000000')) throw new PaystackError('Could not resolve account name', 422)
    return { account_name: 'TEST ACCOUNT HOLDER', account_number: '0123456789' }
  }
  if (path.startsWith('/bank')) return [{ name: 'Guaranty Trust Bank', code: '058', active: true }, { name: 'Access Bank', code: '044', active: true }]
  if (path === '/transferrecipient') return { recipient_code: 'RCP_fake' }
  if (path === '/transfer') return { transfer_code: 'TRF_fake', status: 'pending' }
  if (path === '/refund') return { status: 'pending' }
  if (path === '/transaction/initialize') return { authorization_url: `https://checkout.paystack.com/fake/${ref}`, access_code: `fake_${ref}`, reference: ref }
  if (path === '/charge') return { reference: ref, status: 'pending_bank_transfer', account_name: 'PAYSTACK-TITAN', account_number: '9900000001', bank: { name: 'Paystack-Titan' }, account_expires_at: new Date(Date.now() + 30 * 60_000).toISOString() }
  if (path === '/transaction/charge_authorization') return { id: 1, status: 'success', reference: ref, amount: body.amount, currency: 'NGN', channel: 'card' }
  if (path.startsWith('/transaction/verify/')) return { id: 1, status: 'ongoing', reference: decodeURIComponent(path.split('/').pop()!), amount: 0, currency: 'NGN', channel: 'card' }
  throw new PaystackError(`fake: ${method} ${path} not handled`, 500)
}

async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  if (fake) return fakeCall(method, path, body as Record<string, unknown>) as T
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${secret()}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  })
  const json = (await response.json().catch(() => null)) as PaystackResponse<T> | null
  if (!response.ok || !json?.status) {
    console.error(`Paystack ${method} ${path} failed: ${response.status} ${json?.message}`)
    throw new PaystackError(json?.message ?? `Paystack error ${response.status}`, response.status)
  }
  return json.data
}

export class PaystackError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

export type Authorization = {
  authorization_code: string
  card_type: string
  last4: string
  exp_month: string
  exp_year: string
  bank: string
  brand: string
  reusable: boolean
  signature: string
  channel: string
}

export type Transaction = {
  id: number
  status: 'success' | 'failed' | 'abandoned' | 'ongoing' | 'pending' | 'processing' | 'queued' | 'reversed'
  reference: string
  amount: number
  currency: string
  channel: string
  authorization?: Authorization
  customer?: { email: string }
}

export const paystack = {
  initialize: (input: { email: string; amountKobo: number; reference: string; metadata: Record<string, unknown>; channels?: string[] }) =>
    call<{ authorization_url: string; access_code: string; reference: string }>('POST', '/transaction/initialize', {
      email: input.email,
      amount: input.amountKobo,
      reference: input.reference,
      currency: 'NGN',
      metadata: input.metadata,
      channels: input.channels,
    }),

  verify: (reference: string) => call<Transaction>('GET', `/transaction/verify/${encodeURIComponent(reference)}`),

  chargeAuthorization: (input: { email: string; amountKobo: number; reference: string; authorizationCode: string; metadata: Record<string, unknown> }) =>
    call<Transaction & { authorization_url?: string }>('POST', '/transaction/charge_authorization', {
      email: input.email,
      amount: input.amountKobo,
      reference: input.reference,
      authorization_code: input.authorizationCode,
      currency: 'NGN',
      metadata: input.metadata,
    }),

  // Pay with Transfer: a one-time account number for this payment.
  bankTransfer: (input: { email: string; amountKobo: number; reference: string; metadata: Record<string, unknown>; expiresAt: Date }) =>
    call<{ reference: string; status: string; display_text?: string; account_name?: string; account_number?: string; bank?: { name: string }; account_expires_at?: string }>(
      'POST',
      '/charge',
      {
        email: input.email,
        amount: input.amountKobo,
        reference: input.reference,
        metadata: input.metadata,
        bank_transfer: { account_expires_at: input.expiresAt.toISOString() },
      },
    ),

  banks: () => call<{ name: string; code: string; active: boolean }[]>('GET', '/bank?country=nigeria&currency=NGN&perPage=200'),

  resolveAccount: (accountNumber: string, bankCode: string) =>
    call<{ account_name: string; account_number: string }>('GET', `/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`),

  createRecipient: (input: { name: string; accountNumber: string; bankCode: string }) =>
    call<{ recipient_code: string }>('POST', '/transferrecipient', {
      type: 'nuban',
      name: input.name,
      account_number: input.accountNumber,
      bank_code: input.bankCode,
      currency: 'NGN',
    }),

  transfer: (input: { amountKobo: number; recipientCode: string; reference: string; reason: string }) =>
    call<{ transfer_code: string; status: string }>('POST', '/transfer', {
      source: 'balance',
      amount: input.amountKobo,
      recipient: input.recipientCode,
      reference: input.reference,
      reason: input.reason,
    }),

  refund: (transactionReference: string, amountKobo?: number) =>
    call<{ status: string }>('POST', '/refund', { transaction: transactionReference, ...(amountKobo && { amount: amountKobo }) }),
}

// Paystack signs webhook bodies with HMAC-SHA512 of the raw body and our secret key.
export function validWebhookSignature(rawBody: string, signature: string | null) {
  if (!signature) return false
  const expected = createHmac('sha512', secret()).update(rawBody).digest('hex')
  const a = Buffer.from(expected)
  const b = Buffer.from(signature)
  return a.length === b.length && timingSafeEqual(a, b)
}
