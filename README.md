# Vorapicks

Marketing site and admin web app for Vorapicks, built with Next.js 16 and Tailwind CSS v4. The backend runs on Firebase (Auth and Firestore) through the Firebase Admin SDK on the Next.js server. The buyer, seller and rider apps are in Flutter and use the REST API described in [docs/api.md](./docs/api.md).

## Run it locally

```bash
pnpm install
cp .env.example .env.local   # fill in the Firebase values
pnpm db:seed                 # optional: development data for the admin app (dev projects only)
pnpm dev                     # http://localhost:3000
```

## Environment

| Variable | What |
| --- | --- |
| `FIREBASE_PROJECT_ID` | Firebase project (`vorapicks-dev` for development) |
| `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | Service account for the Admin SDK. Server-only. |
| `FIREBASE_WEB_API_KEY` | Web API key of the project's web app. The server uses it to check admin passwords. |

## Admin app (`/admin`)

- **Sign-up** at `/admin/signup` creates a Firebase Auth user and a pending `admins/{uid}` record. The phone check on that screen is still a demo (code `2314`); no SMS is sent.
- **Approval:** a new account cannot sign in until it is approved:

  ```bash
  pnpm admin:approve someone@example.com            # grant
  pnpm admin:approve someone@example.com --revoke   # remove and end their sessions
  ```

- **Sessions** are Firebase session cookies (httpOnly, 7 days), verified on every request together with the `admin` claim (`lib/admin/session.ts`).
- **Data** is read from Firestore (`orders`, `disputes`, `users`, `conversations`, `meta/dashboard`) in `lib/admin/data.ts`. Admin actions go through the `applyAdminAction` server action in `app/admin/actions.ts`, which re-checks the session, validates the input and updates the document in a transaction. `lib/admin/admin-actions.ts` defines the actions once for both the browser and the server.

## Mobile API (`/api/v1`)

For the Flutter apps. Every response uses `{ success, message, data | error }`. Users authenticate with a Firebase ID token as a Bearer token. See [docs/api.md](./docs/api.md).

## Firestore rules

`firestore.rules` denies all direct client access, since everything goes through the server. Deploy with `firebase deploy --only firestore:rules`.
