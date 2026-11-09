import { fail } from '@/lib/api/response'

// Unknown /api paths still answer in the standard envelope.
function notFound() {
  return fail('not_found', 'No such endpoint')
}

export const GET = notFound
export const POST = notFound
export const PUT = notFound
export const PATCH = notFound
export const DELETE = notFound
