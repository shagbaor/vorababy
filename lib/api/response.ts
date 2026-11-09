import { NextResponse } from 'next/server'

// Every /api response uses one envelope so the Flutter app can parse them the
// same way (see docs/api.md):
//   { "success": true,  "message": "...", "data": { ... } }
//   { "success": false, "message": "...", "error": { "code": "...", "details": ... } }

export type ApiSuccess<T> = { success: true; message: string; data: T }
export type ApiFailure = { success: false; message: string; error: { code: ApiErrorCode; details?: unknown } }

export type ApiErrorCode =
  | 'bad_request'
  | 'validation_failed'
  | 'unauthenticated'
  | 'forbidden'
  | 'account_disabled'
  | 'not_found'
  | 'method_not_allowed'
  | 'conflict'
  | 'rate_limited'
  | 'internal_error'

const STATUS: Record<ApiErrorCode, number> = {
  bad_request: 400,
  validation_failed: 422,
  unauthenticated: 401,
  forbidden: 403,
  account_disabled: 403,
  not_found: 404,
  method_not_allowed: 405,
  conflict: 409,
  rate_limited: 429,
  internal_error: 500,
}

export function ok<T>(data: T, message = 'OK', status = 200) {
  return NextResponse.json<ApiSuccess<T>>({ success: true, message, data }, { status })
}

export function fail(code: ApiErrorCode, message: string, details?: unknown) {
  const error = details === undefined ? { code } : { code, details }
  return NextResponse.json<ApiFailure>({ success: false, message, error }, { status: STATUS[code] })
}

// Throw from a handler to return a failure response.
export class ApiError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message)
  }
}

type Handler<C> = (request: Request, context: C) => Promise<Response>

// Wraps a route handler so thrown ApiErrors and unexpected errors still come
// back in the envelope.
export function handle<C>(handler: Handler<C>): Handler<C> {
  return async (request, context) => {
    try {
      return await handler(request, context)
    } catch (error) {
      if (error instanceof ApiError) return fail(error.code, error.message, error.details)
      console.error(error)
      return fail('internal_error', 'Something went wrong. Please try again.')
    }
  }
}

export async function readJson<T = unknown>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T
  } catch {
    throw new ApiError('bad_request', 'Request body must be valid JSON')
  }
}

// Next.js answers unsupported methods with an empty 405; export this for the
// methods a route does not implement so the envelope is kept.
export const methodNotAllowed = async () => fail('method_not_allowed', 'Method not allowed')
