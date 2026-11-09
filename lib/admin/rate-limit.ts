import 'server-only'
import { createHash } from 'node:crypto'
import { headers } from 'next/headers'
import { db } from '@/lib/firebase/admin'

// Simple per-visitor limits for public forms (admin sign-up requests, password
// reset emails). Counts live in Firestore rateLimits/{hash}; the visitor's IP
// is only stored hashed.

async function visitorKey(bucket: string) {
  const h = await headers()
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown'
  return createHash('sha256').update(`vorapicks:${bucket}:${ip}`).digest('hex')
}

// Records an attempt and returns false once `limit` attempts were made in the
// last `windowMinutes`.
export async function allowAttempt(bucket: string, limit: number, windowMinutes: number) {
  const ref = db().collection('rateLimits').doc(await visitorKey(bucket))
  const now = Date.now()
  const since = now - windowMinutes * 60_000

  return db().runTransaction(async (transaction) => {
    const hits = ((await transaction.get(ref)).get('hits') as number[] | undefined)?.filter((t) => t > since) ?? []
    if (hits.length >= limit) return false
    transaction.set(ref, { hits: [...hits, now], expiresAt: new Date(now + windowMinutes * 60_000) })
    return true
  })
}
