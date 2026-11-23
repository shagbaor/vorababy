import 'server-only'

// Handoff code: the last 4 digits of the order number (VP-2026-000142 → 0142).
// The seller and rider see it; the rider says it to the buyer, who enters it
// to confirm the delivery and release the payment.
export const HANDOFF_MAX_TRIES = 5

export function handoffCode(orderNumber: string) {
  const digits = String(orderNumber).replace(/\D/g, '')
  return digits.slice(-4).padStart(4, '0')
}
