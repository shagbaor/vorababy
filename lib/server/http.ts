import { NextResponse } from 'next/server'
import { z } from 'zod'

// Every API error has the same shape so the app can show `message` and branch on `code`:
// { "error": { "code": "already_registered", "message": "...", "fields"?: {...} } }

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message)
  }
}

export const errors = {
  unauthenticated: () => new ApiError(401, 'unauthenticated', 'Sign in again to continue.'),
  forbidden: (message = "You don't have permission to do that.") => new ApiError(403, 'forbidden', message),
  notFound: (what: string) => new ApiError(404, 'not_found', `${what} was not found.`),
  conflict: (code: string, message: string) => new ApiError(409, code, message),
  invalid: (message: string, fields?: Record<string, string>) => new ApiError(400, 'invalid_request', message, fields),
}

export async function readJson<T extends z.ZodType>(request: Request, schema: T): Promise<z.infer<T>> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    throw errors.invalid('Send the request body as JSON.')
  }
  const result = schema.safeParse(body)
  if (!result.success) {
    const fields: Record<string, string> = {}
    for (const issue of result.error.issues) {
      const key = issue.path.join('.') || 'body'
      fields[key] ??= issue.message
    }
    throw errors.invalid('Some fields are missing or invalid.', fields)
  }
  return result.data
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status })
}

type Handler<C> = (request: Request, context: C) => Promise<Response>

// Wraps a route handler so thrown ApiErrors become clean JSON responses and
// anything unexpected is logged and hidden behind a generic 500.
export function route<C = unknown>(handler: Handler<C>): Handler<C> {
  return async (request, context) => {
    try {
      return await handler(request, context)
    } catch (error) {
      if (error instanceof ApiError) {
        return NextResponse.json(
          { error: { code: error.code, message: error.message, ...(error.fields && { fields: error.fields }) } },
          { status: error.status },
        )
      }
      console.error(error)
      return NextResponse.json(
        { error: { code: 'internal', message: 'Something went wrong on our side. Try again.' } },
        { status: 500 },
      )
    }
  }
}
