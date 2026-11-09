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

- **Admin sign-up** at `/admin/signup` (email and password) or with "Continue with Google" on the login or sign-up page. Either way it files a pending request in `admins/{uid}`; nobody gets in until a super admin approves them. Each network can file at most 5 requests an hour (`lib/admin/rate-limit.ts`), and at most 25 can wait at once.
- **Roles:** super admins manage the team on **Admin Team** (`/admin/team`): approve, reject, remove or restore admins, and make other admins super admins or remove that role. Regular admins run orders, disputes, users and support, and see the team read-only. Nobody can change their own access, and the last super admin cannot be removed. Roles are read on every request, so changes apply at once.
- **First super admin:** approve from the command line once; everything after that happens in the app:

  ```bash
  pnpm admin:approve someone@example.com --super    # approve as super admin
  pnpm admin:approve someone@example.com            # approve as regular admin
  pnpm admin:approve someone@example.com --revoke   # remove and end their sessions
  ```

- **Password reset:** "Forgot password?" (`/admin/forgot-password`) sends Firebase's reset email. The page answers the same whether or not the email has an account, and each network can request 5 an hour.
- **Sessions** are Firebase session cookies (httpOnly, 7 days), verified on every request together with the `admin` claim (`lib/admin/session.ts`).
- **Marketplace users** are the buyers, sellers and riders who register through the mobile API (`users/{uid}`, keyed by Firebase uid, newest first). Admins can verify users and edit their name, phone and location. Suspending or banning a user also disables their Firebase account and ends their sessions, so the mobile apps lock them out at once. The dashboard's seller, rider and user counts are live.
- **Data** is read from Firestore in `lib/admin/data.ts`. Admin actions go through the `applyAdminAction` server action in `app/admin/actions.ts`, which re-checks the session, validates the input, updates the document in a transaction and mirrors the change onto Firebase Auth. `lib/admin/admin-actions.ts` defines the actions once for both the browser and the server.
- **Still sample data:** orders, disputes, support conversations and the revenue and order figures, until the mobile apps create real ones. `pnpm db:seed` (dev only) writes them, plus seven sample users with Firebase accounts.

## Mobile API (`/api/v1`)

For the Flutter apps. Every response uses `{ success, message, data | error }`. Users authenticate with a Firebase ID token as a Bearer token. See [docs/api.md](./docs/api.md).

## Firestore rules

`firestore.rules` denies all direct client access, since everything goes through the server. Deploy with `firebase deploy --only firestore:rules`.
