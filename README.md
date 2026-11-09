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
| `PAYSTACK_SECRET_KEY` | Paystack secret key (test or live). Server-only: never in the apps. Webhook: `https://<domain>/api/v1/paystack/webhook`. |
| `CRON_SECRET` | Any long random string. Vercel Cron sends it to `/api/v1/cron/run` (daily: auto-release delivered orders after 48 h, expire splits, close old shopping requests). |

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
- **Dashboard figures** are calculated from Firestore on every load (`lib/admin/data.ts`): orders today vs yesterday, open disputes, money held in escrow, users, active sellers and riders. **Earnings** (Vorapicks' commission on orders released to sellers; rate in `meta/settings.commissionRate`, default 10%) for today, this week (from Monday, Lagos time) and all time are calculated and sent only for super admins.
- **Marketplace users** are the buyers, sellers and riders who register through the mobile API (`users/{uid}`, keyed by Firebase uid, newest first). Admins can verify users and edit their name, phone and location. Suspending or banning a user also disables their Firebase account and ends their sessions, so the mobile apps lock them out at once. 
- **Data** is read from Firestore in `lib/admin/data.ts`. Admin actions go through the `applyAdminAction` server action in `app/admin/actions.ts`, which re-checks the session, validates the input, updates the document in a transaction and mirrors the change onto Firebase Auth. `lib/admin/admin-actions.ts` defines the actions once for both the browser and the server.
- **App data:** orders, disputes and support conversations created through the mobile API appear here; releasing or refunding an app order moves real money through escrow and wallets, and admin replies in Support reach the user's app as a push. Sample data: `pnpm db:seed` (dev only) writes them, plus seven sample users with Firebase accounts.

## Mobile API (`/api/v1`)

For the Flutter apps (buyer, seller and rider). Every response uses `{ success, message, data | error }`. Users authenticate with a Firebase ID token as a Bearer token. The full guide for the app developer, screen by screen, is [docs/mobile-api.md](./docs/mobile-api.md); [docs/api.md](./docs/api.md) covers the envelope.

Routes live in `app/api/v1`, business logic in `lib/server` (cart and checkout, Paystack payments and escrow, orders, riders, chat, split the bill, personal shopping). Amounts are in kobo. Fees and limits come from `meta/settings` (defaults in `lib/server/settings.ts`). Firebase Storage must be enabled for uploads.

## Firestore rules

All writes go through the server. `firestore.rules` lets signed-in app users **read** only their own live data (profile and wallet balance, notifications, unread count, orders they are part of, their chats, support thread and splits) and nothing else. Publish with `pnpm db:rules`.
