const naira = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  currencyDisplay: 'narrowSymbol',
  maximumFractionDigits: 0,
})

const nairaWithKobo = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  currencyDisplay: 'narrowSymbol',
  minimumFractionDigits: 2,
})

/** ₦12,840,000 */
export function formatNaira(amount: number) {
  return naira.format(amount)
}

/** ₦16.50 */
export function formatNairaExact(amount: number) {
  return nairaWithKobo.format(amount)
}

/** ₦5.1M, ₦840K */
export function formatNairaCompact(amount: number) {
  if (amount >= 1_000_000) return `₦${+(amount / 1_000_000).toFixed(1)}M`
  if (amount >= 1_000) return `₦${+(amount / 1_000).toFixed(1)}K`
  return formatNaira(amount)
}

/** 10:22 AM */
export function currentTime() {
  return new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

/** Amaka Osei -> AO */
export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('')
}
