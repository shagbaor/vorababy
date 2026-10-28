# Vorapicks backend: guide for the app

How the Vorapicks Flutter app talks to the backend. This covers **stage 1: accounts**. Later stages (shop, orders, payments, delivery, chat) will be added here as they're built.

## How it fits together

- **Firebase project:** `vorapicks-dev` for development. A separate `vorapicks-prod` comes before launch.
- **Sign-in:** Firebase Authentication with phone number + SMS code.
- **Data:** Cloud Firestore. The app reads its own data directly and listens for live changes.
- **Server API:** HTTPS endpoints at `https://<site>/api/v1/…`, hosted with the website on Vercel. Anything that changes a role, verification, money or another person's data goes through here, never through a direct Firestore write.

Firestore security rules (`firebase/firestore.rules`) enforce what the app can read and write. If a direct write is refused, it's meant to go through the API instead.

## Flutter packages

| Package | Used for |
|---|---|
| `firebase_core`, `firebase_auth` | Phone sign-in |
| `cloud_firestore` | Reading data and live updates |
| `http` or `dio` | Calling the server API |
| `firebase_messaging` | Push notifications (later stage) |

Set up with `flutterfire configure --project=vorapicks-dev`. That registers the Android and iOS apps and writes `firebase_options.dart`.

## Test phone numbers

These sign in without sending a real SMS. They're set up in the Firebase console under Authentication → Sign-in method → Phone.

| Number | Code | Use for |
|---|---|---|
| +234 800 000 0001 | 111111 | Buyer |
| +234 800 000 0002 | 222222 | Seller |
| +234 800 000 0003 | 333333 | Rider |

## Sign-up flow

1. **Phone verification.** `FirebaseAuth.instance.verifyPhoneNumber(...)` → user enters the code → signed in.
2. **Check for an existing profile.** `GET /api/v1/me`. If `data.user` is `null`, they haven't finished sign-up; show "Choose Your Role". Otherwise go to the home screen for `data.user.role`.
3. **Create the profile.** `POST /api/v1/signup` with the chosen role and name.
4. **Refresh the token.** Call `await user.getIdToken(true)`. The role is stored on the token, and the old token doesn't have it yet.
5. **Sellers:** `POST /api/v1/stores`. **Riders:** `POST /api/v1/riders`. Both then wait for an admin to verify them; show a "pending review" screen while `user.verificationStatus` is `pending`.
6. **Listen for approval.** Listen to `users/{uid}`. When `verificationStatus` becomes `approved`, unlock the seller or rider screens.

A role can't be changed after sign-up. To test another role, use another test number.

## Calling the API

Every request needs the Firebase ID token:

```
Authorization: Bearer <await FirebaseAuth.instance.currentUser!.getIdToken()>
Content-Type: application/json
```

Successful responses wrap the result in `data`:

```json
{ "data": { ... } }
```

Errors always look like this. Show `message` to the user; branch on `code`:

```json
{
  "error": {
    "code": "invalid_request",
    "message": "Some fields are missing or invalid.",
    "fields": { "fullName": "Enter at least 2 characters." }
  }
}
```

| Status | `code` | Meaning |
|---|---|---|
| 400 | `invalid_request` | Check `fields` for which inputs to fix |
| 401 | `unauthenticated` | Token missing or expired, or the account was suspended or banned. Sign out. |
| 403 | `forbidden` | Wrong account type for this action, or the token is missing the new role (refresh it) |
| 409 | various | Already done, e.g. `already_registered`, `store_exists`, `rider_exists`, `signup_incomplete` |
| 500 | `internal` | Server problem; retry |

### `GET /api/v1/me`

The signed-in person's profile. `store` is set for sellers who registered one, `rider` for riders who added their vehicle.

```json
{
  "data": {
    "user": {
      "id": "Xk2…",
      "role": "seller",
      "fullName": "Chidi Okafor",
      "email": null,
      "phone": "+2348000000002",
      "photoUrl": null,
      "status": "active",
      "verified": false,
      "verificationStatus": "pending",
      "storeId": "s9F…",
      "createdAt": "2026-10-28T18:45:51.000Z",
      "updatedAt": "2026-10-28T18:46:02.000Z"
    },
    "store": { "id": "s9F…", "name": "Green Valley Farm", "verificationStatus": "pending", "...": "..." },
    "rider": null
  }
}
```

### `POST /api/v1/signup`

```json
{ "role": "buyer", "fullName": "Amaka Osei", "email": "amaka@example.com" }
```

- `role`: `buyer`, `seller` or `rider` (from "Choose Your Role")
- `fullName`: 2–80 characters
- `email`: optional

Returns `201` with the same shape as `/me`. The phone number comes from the verified sign-in, so the app doesn't send it.

### `POST /api/v1/stores` (sellers)

```json
{
  "name": "Green Valley Farm",
  "type": "farm",
  "description": "Fresh vegetables from Epe",
  "phone": "+2348031234567",
  "address": { "line": "4 Farm Road", "area": "Epe", "city": "Lagos", "state": "Lagos" },
  "location": { "lat": 6.5841, "lng": 3.9834 }
}
```

- `type`: `farm`, `restaurant` or `vendor`
- `location`: the pin the seller drops on the map, used later for delivery distance
- One store per seller. It's hidden from buyers until an admin verifies it.

### `POST /api/v1/riders` (riders)

```json
{ "vehicleType": "motorbike", "plateNumber": "LND-123-XY" }
```

- `vehicleType`: `motorbike`, `bicycle`, `car` or `van`
- `plateNumber`: required except for bicycles

ID and licence photo uploads come later, once file storage is enabled.

## What the app reads and writes directly in Firestore

| Path | Read | Write from the app |
|---|---|---|
| `users/{uid}` | Own only | `fullName`, `photoUrl`, with `updatedAt: FieldValue.serverTimestamp()` |
| `users/{uid}/addresses/{id}` | Own only | Create, edit, delete (fields below) |
| `users/{uid}/devices/{id}` | Own only | `token`, `platform` (`android`, `ios`), `updatedAt` |
| `stores/{id}` | Approved stores; owners see their own | Owner: `description`, `logoUrl`, `coverUrl`, `isOpen`, `openingHours`, `updatedAt` |
| `riders/{uid}` | Own only | Approved rider: `isOnline`, `updatedAt` |
| `categories/{id}` | Everyone | No |
| `config/public` | Everyone | No |

Every direct write must set `updatedAt` to `FieldValue.serverTimestamp()`, or it's refused.

When listing stores, filter by `verificationStatus == 'approved'`; an unfiltered query is refused.

**Address fields:** `label` (e.g. "Home"), `line`, `area` (optional), `city`, `state` (optional), `location` (`GeoPoint`), `instructions` (optional), `isDefault` (bool), `updatedAt`.

**Store `openingHours`:** a map of weekday to hours or `null` when closed, e.g. `{ "mon": { "open": "08:00", "close": "18:00" }, "sun": null }`.

## Account states

| Field | Values |
|---|---|
| `role` | `buyer`, `seller`, `rider` (and `admin`, website only) |
| `status` | `active`, `suspended`, `banned`. Suspended and banned accounts are signed out and can't sign in. |
| `verificationStatus` | Buyers: `not_required`. Sellers and riders: `incomplete` (no store or vehicle yet) → `pending` (waiting for admin) → `approved`. |

## Money

All amounts are whole **kobo** (₦1 = 100 kobo). `config/public` holds the fees the app shows, e.g. `deliveryBaseFeeKobo`.

## Running the backend locally

Needs Node 22 and Java 21.

```bash
pnpm install && (cd firebase && pnpm install)
pnpm test:rules      # security rules tests
pnpm test:api        # API tests
cd firebase && npm run emulators   # local Firebase on ports 9099 (Auth) and 8080 (Firestore)
```

Point the Flutter app at the emulators with `FirebaseAuth.instance.useAuthEmulator(host, 9099)` and `FirebaseFirestore.instance.useFirestoreEmulator(host, 8080)`.
