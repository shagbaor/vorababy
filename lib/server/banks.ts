import 'server-only'
import { FieldValue } from 'firebase-admin/firestore'
import { z } from 'zod'
import { ApiError } from '@/lib/api/response'
import { db } from '@/lib/firebase/admin'
import { paystack, PaystackError } from '@/lib/server/paystack'

export const accountSchema = z.object({
  bankCode: z.string().trim().min(2).max(10),
  accountNumber: z.string().trim().regex(/^\d{10}$/, 'Enter the 10-digit account number'),
})

// Nigerian banks from Paystack, cached for a day in meta/banks.
export async function listBanks() {
  const ref = db().collection('meta').doc('banks')
  const cached = await ref.get()
  const fetchedAt = cached.get('fetchedAt')?.toDate?.() as Date | undefined
  if (cached.exists && fetchedAt && Date.now() - fetchedAt.getTime() < 24 * 60 * 60 * 1000) {
    return cached.get('banks') as { code: string; name: string }[]
  }
  try {
    const banks = (await paystack.banks()).filter((b) => b.active).map((b) => ({ code: b.code, name: b.name }))
    await ref.set({ banks, fetchedAt: FieldValue.serverTimestamp() })
    return banks
  } catch (error) {
    if (cached.exists) return cached.get('banks') as { code: string; name: string }[]
    throw error
  }
}

export async function resolveAccount(bankCode: string, accountNumber: string) {
  const bank = (await listBanks()).find((b) => b.code === bankCode)
  if (!bank) throw new ApiError('validation_failed', 'Choose your bank', { bankCode: 'Choose your bank' })
  try {
    const resolved = await paystack.resolveAccount(accountNumber, bankCode)
    return { bankCode, bankName: bank.name, accountNumber, accountName: resolved.account_name }
  } catch (error) {
    if (error instanceof PaystackError && error.status < 500) {
      throw new ApiError('validation_failed', 'We could not find this account', { accountNumber: 'Check the account number and bank' })
    }
    throw error
  }
}
