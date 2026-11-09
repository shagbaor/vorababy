# Vorapicks API (for the Flutter app)

Base URL: `https://<host>/api/v1`. All requests and responses are JSON.

## Response format

Every response, success or failure, has the same shape.

Success:

```json
{
  "success": true,
  "message": "Signed in",
  "data": { "uid": "abc123", "email": "ada@example.com", "phone": "+2348012345678" }
}
```

Failure:

```json
{
  "success": false,
  "message": "Session expired. Refresh the token and retry.",
  "error": { "code": "unauthenticated" }
}
```

- `message` is a human-readable sentence the app can show to the user.
- `error.code` is stable and meant for app logic. Branch on it, not on `message`.
- `error.details` appears only when there is more to say. For `validation_failed`, it maps field names to messages, e.g. `{ "email": "Enter a valid email address" }`.
- The HTTP status matches the code:

| `error.code` | HTTP |
| --- | --- |
| `bad_request` | 400 |
| `unauthenticated` | 401 |
| `forbidden` | 403 |
| `not_found` | 404 |
| `method_not_allowed` | 405 |
| `conflict` | 409 |
| `validation_failed` | 422 |
| `rate_limited` | 429 |
| `internal_error` | 500 |

## Authentication

Users sign in in the app with the Firebase Auth SDK (`firebase_auth`) on the Firebase project for that environment (`vorapicks-dev` for development). Send the current ID token with every request that needs a user:

```
Authorization: Bearer <ID token>
```

In Dart: `await FirebaseAuth.instance.currentUser!.getIdToken()`. The SDK refreshes the token for you. On `401` with code `unauthenticated`, call `getIdToken(true)` and retry once. If that also fails, send the user to sign-in.

The app does not read or write Firestore directly: security rules deny all client access, and all data goes through this API.

## Endpoints

### `GET /health`

No auth. Returns `data: { "status": "up", "version": "v1", "time": "<ISO 8601>" }`.

### `GET /me`

Auth required. Returns the signed-in user: `data: { "uid", "email", "phone" }` (`email` or `phone` is `null` when the account does not have one).

Marketplace endpoints (buyers, sellers, riders) will be added here as they are agreed.
