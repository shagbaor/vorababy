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
| `account_disabled` | 403 |
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

On `403` with code `account_disabled`, an admin has suspended or banned the account. Show the message and sign the user out. Firebase sign-in for that account fails with `user-disabled` until the suspension is lifted.

### Sign-up flow

1. Create the account with `firebase_auth` (email and password, or phone).
2. Call `POST /me` with the user's name and role. This registers them as a buyer, seller or rider, and they appear in the admin app right away.
3. On later launches, call `GET /me`. If `profile` is `null`, the account exists but the profile was never registered, so send the user back to step 2.

The app does not read or write Firestore directly: security rules deny all client access, and all data goes through this API.

## Endpoints

### `GET /health`

No auth. Returns `data: { "status": "up", "version": "v1", "time": "<ISO 8601>" }`.

### `GET /me`

Auth required. Returns the signed-in user and their profile:

```json
{
  "uid": "LndJ38iCpWb4MFbngNnT533WsJI3",
  "email": "ngozi@example.com",
  "phone": null,
  "profile": {
    "name": "Ngozi Okafor",
    "role": "buyer",
    "phone": "+2348099998888",
    "location": "Yaba, Lagos",
    "verified": false,
    "status": "active",
    "createdAt": "2026-11-09T12:27:24.615Z"
  }
}
```

The top-level `email` and `phone` come from the Firebase account and are `null` if it has none. `profile` is `null` until the user registers. `role` is `buyer`, `seller` or `rider`. `status` is `active`, `suspended` or `banned`. `verified` is set by an admin.

### `POST /me`

Auth required. Registers the profile, once per account.

```json
{ "name": "Ngozi Okafor", "role": "buyer", "phone": "08031112222", "location": "Ikeja, Lagos" }
```

- `name` (2–100 characters) and `role` are required.
- `phone` is optional. Nigerian local formats (`0803…`, `803…`) are stored as `+234…`, and international numbers starting with `+` are kept as entered. If it is left out, the Firebase account's phone number is used.
- `location` is optional (up to 120 characters).
- Returns `201` with the same `data` as `GET /me`.
- Errors: `422 validation_failed`, with `error.details` per field (`name`, `phone`, `location`, `role`), or `409 conflict` if a profile already exists.

### `PATCH /me`

Auth required. Updates any of `name`, `phone`, `location`. The role cannot be changed. Returns the updated `data`. Errors: `404 not_found` if no profile is registered, `422 validation_failed`.

Marketplace endpoints (buyers, sellers, riders) will be added here as they are agreed.
