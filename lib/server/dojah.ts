import 'server-only'

// Thin client for the Dojah identity API (https://docs.dojah.io). Keys live on
// the server only: DOJAH_APP_ID and DOJAH_SECRET_KEY. DOJAH_BASE_URL defaults
// to the live API; set it to https://sandbox.dojah.io with sandbox keys.

export class DojahError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
  // 404 / 400-style answers mean "no record"; anything else means Dojah is
  // unavailable and the check should wait for a person.
  get notFound() {
    return this.status === 404 || this.status === 400 || this.status === 422
  }
}

export type NinRecord = {
  firstName: string
  middleName: string
  lastName: string
  dateOfBirth: string | null
  // Selfie checks only.
  selfieMatch?: boolean
  selfieConfidence?: number | null
}
export type CacRecord = { companyName: string; rcNumber: string; status: string | null; type: string | null }
export type LicenceRecord = { firstName: string; middleName: string; lastName: string; expiryDate: string | null }

// Local testing only: DOJAH_FAKE=1 answers without contacting Dojah. Ignored
// on Vercel, so it can never affect the live site.
const fake = process.env.DOJAH_FAKE === '1' && !process.env.VERCEL

export function dojahConfigured() {
  return fake || Boolean(process.env.DOJAH_APP_ID && process.env.DOJAH_SECRET_KEY)
}

async function call(method: 'GET' | 'POST', path: string, body?: unknown): Promise<Record<string, any>> {
  if (fake) return fakeCall(path, body as Record<string, string>)
  const appId = process.env.DOJAH_APP_ID
  const secret = process.env.DOJAH_SECRET_KEY
  if (!appId || !secret) throw new DojahError('Dojah is not set up', 503)
  const base = process.env.DOJAH_BASE_URL || 'https://api.dojah.io'
  let response: Response
  try {
    response = await fetch(base + path, {
      method,
      // Dojah takes the secret key as-is, without "Bearer".
      headers: { AppId: appId, Authorization: secret, 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(25_000),
    })
  } catch {
    throw new DojahError('Dojah did not answer', 503)
  }
  const json = (await response.json().catch(() => ({}))) as { entity?: Record<string, any>; error?: string }
  if (!response.ok || !json.entity) throw new DojahError(json.error || `Dojah ${response.status}`, response.status === 200 ? 404 : response.status)
  return json.entity
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

function ninRecord(e: Record<string, any>): NinRecord {
  const selfie = e.selfie_verification as { match?: boolean; confidence_value?: number } | undefined
  return {
    firstName: str(e.first_name ?? e.firstname),
    middleName: str(e.middle_name ?? e.middlename),
    lastName: str(e.last_name ?? e.surname ?? e.lastname),
    dateOfBirth: str(e.date_of_birth ?? e.birthdate) || null,
    ...(selfie && { selfieMatch: Boolean(selfie.match), selfieConfidence: selfie.confidence_value ?? null }),
  }
}

export async function lookupNin(nin: string) {
  return ninRecord(await call('GET', `/api/v1/kyc/nin?nin=${encodeURIComponent(nin)}`))
}

// NIN lookup plus a match of the selfie against the NIN photo, in one call.
export async function verifyNinWithSelfie(nin: string, selfieBase64: string, threshold: number) {
  return ninRecord(await call('POST', '/api/v1/kyc/nin/verify', { nin, selfie_image: selfieBase64, threshold }))
}

// Is the selfie a live person (not a photo of a photo or a screen)?
export async function liveness(imageBase64: string) {
  const e = await call('POST', '/api/v1/ml/liveness', { image: imageBase64 })
  const l = (e.liveness ?? e) as { liveness_check?: boolean; liveness_probability?: number }
  return { live: Boolean(l.liveness_check), probability: l.liveness_probability ?? null }
}

export async function lookupCac(rcNumber: string, companyType: string): Promise<CacRecord> {
  const e = await call('GET', `/api/v1/kyc/cac/basic?rc_number=${encodeURIComponent(rcNumber)}&company_type=${encodeURIComponent(companyType)}`)
  return {
    companyName: str(e.company_name ?? e.companyName),
    rcNumber: str(e.rc_number ?? e.rcNumber) || rcNumber,
    status: str(e.company_status ?? e.status) || null,
    type: str(e.company_type ?? e.type) || null,
  }
}

export async function lookupLicence(licenceNumber: string): Promise<LicenceRecord> {
  const e = await call('GET', `/api/v1/kyc/dl?license_number=${encodeURIComponent(licenceNumber)}`)
  return {
    firstName: str(e.firstName ?? e.first_name),
    middleName: str(e.middleName ?? e.middle_name),
    lastName: str(e.lastName ?? e.last_name),
    expiryDate: str(e.expiryDate ?? e.expiry_date) || null,
  }
}

// Fake answers. NINs starting 1 belong to "Grace Adebayo", 2 to "Emeka
// Okafor" (born 1990-01-01); 0… is not found. A selfie containing "nomatch"
// does not match, "spoof" fails liveness, "down" makes Dojah unavailable.
function fakeCall(path: string, body: Record<string, string> = {}): Record<string, any> {
  const q = new URLSearchParams(path.split('?')[1] ?? '')
  const person = (id: string) =>
    id.startsWith('1') ? { first_name: 'Grace', middle_name: '', last_name: 'Adebayo', date_of_birth: '1990-01-01' } : id.startsWith('2') ? { first_name: 'Emeka', middle_name: 'John', last_name: 'Okafor', date_of_birth: '1990-01-01' } : null
  if (path.startsWith('/api/v1/kyc/nin/verify')) {
    if (body.selfie_image.includes('down')) throw new DojahError('fake outage', 503)
    const p = person(body.nin)
    if (!p) throw new DojahError('NIN not found', 404)
    const match = !body.selfie_image.includes('nomatch')
    return { ...p, selfie_verification: { match, confidence_value: match ? 96 : 31 } }
  }
  if (path.startsWith('/api/v1/kyc/nin')) {
    const p = person(q.get('nin') ?? '')
    if (!p) throw new DojahError('NIN not found', 404)
    return p
  }
  if (path.startsWith('/api/v1/ml/liveness')) return { liveness: { liveness_check: !body.image.includes('spoof'), liveness_probability: body.image.includes('spoof') ? 0.1 : 0.98 } }
  if (path.startsWith('/api/v1/kyc/cac')) {
    const rc = q.get('rc_number') ?? ''
    if (rc === '000000') throw new DojahError('Company not found', 404)
    return { company_name: 'GREEN VALLEY FARMS LIMITED', rc_number: rc, company_status: rc === '999999' ? 'INACTIVE' : 'ACTIVE', company_type: q.get('company_type') }
  }
  if (path.startsWith('/api/v1/kyc/dl')) {
    const n = q.get('license_number') ?? ''
    if (n.startsWith('X')) throw new DojahError('Licence not found', 404)
    return { firstName: 'Emeka', middleName: 'John', lastName: 'Okafor', expiryDate: n.startsWith('OLD') ? '2020-01-01' : '2030-01-01' }
  }
  throw new DojahError(`fake: ${path} not handled`, 500)
}
