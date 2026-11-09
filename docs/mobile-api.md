# Vorapicks mobile backend: integration guide

For the Flutter developer building the **buyer**, **seller** and **rider** apps. It covers every screen in the Figma file *NEW VORAPICKS (Copy)* (pages "Page 1" = buyer, "SELLER VIEW", "DRIVER") and says, for each one, which endpoint or live data feed it uses.

**Status:** every endpoint in this guide is ✅ built and tested against the `vorapicks-dev` Firebase project. Voice/video calls and the Vora AI assistant are **not planned for now** (section 10). See [section 15](#15-build-stages-and-launch-checklist) for what still needs switching on before launch.

If the app already does something the design does not show (for example store opening hours), tell us, and it is added here rather than the app working around it.

---

## 1. How it fits together

```
Flutter app ──① sign in──────────────► Firebase Authentication
     │                                   (Google, Apple, email+password, phone SMS)
     ├──② everything that changes data ─► Vorapicks API  https://vorapicks.com/api/v1
     │                                      │ checks the token, the role and the rules
     │                                      ▼
     ├──③ live updates (read only) ──────► Cloud Firestore  ◄── admin website
     ├──④ files (photos, documents) ─────► Firebase Storage (upload URL from the API)
     ├──⑤ paying ───────────────────────► Paystack checkout  ──► confirms to our API
     └──⑥ push notifications ◄────────── Firebase Cloud Messaging
```

- **Firebase project:** `vorapicks-dev` while building. A separate production project comes before launch; you will get its config files then.
- **Flutter packages:** `firebase_core`, `firebase_auth`, `google_sign_in`, `sign_in_with_apple`, `cloud_firestore` (live reads only), `firebase_storage`, `firebase_messaging`, `google_maps_flutter`, `geolocator`, `http` or `dio`, and the Paystack checkout (`flutter_paystack_plus` or opening Paystack's `authorization_url` in a web view).
- **Setup:** `flutterfire configure --project=vorapicks-dev` registers the Android and iOS apps. For Google sign-in on Android add your SHA-1 and SHA-256 in Firebase → Project settings → Your apps.
- **Never in the app:** the Paystack *secret* key or any Firebase service-account key. The app only uses the Firebase config files and the Paystack *public* key.

## 2. Conventions (all endpoints)

### Requests

```
Authorization: Bearer <await FirebaseAuth.instance.currentUser!.getIdToken()>
Content-Type: application/json
```

Base URL: `https://vorapicks.com/api/v1`. Every endpoint needs the token except those marked *public*.

### Responses

Success:

```json
{ "success": true, "message": "Order placed", "data": { } }
```

Failure:

```json
{ "success": false, "message": "Some details need fixing", "error": { "code": "validation_failed", "details": { "name": "Enter a name between 2 and 100 characters" } } }
```

- Show `message` to the user. Branch on `error.code`, never on the text.
- For `validation_failed`, `error.details` maps each field to its message.

| `error.code` | HTTP | What the app does |
| --- | --- | --- |
| `bad_request` | 400 | Bug in the request; log it |
| `unauthenticated` | 401 | `getIdToken(true)` and retry once, then sign out |
| `account_disabled` | 403 | Suspended or banned: show the message and sign out |
| `forbidden` | 403 | Wrong role, or not verified yet |
| `not_found` | 404 | |
| `method_not_allowed` | 405 | Bug |
| `conflict` | 409 | Already done (e.g. profile exists, order already accepted) |
| `validation_failed` | 422 | Show `details` under the fields |
| `payment_required` | 402 | Not enough wallet balance / payment not completed |
| `rate_limited` | 429 | Too many attempts; try later |
| `internal_error` | 500 | Retry later |

### Data formats

| What | Format |
| --- | --- |
| Money | Whole **kobo**, integer: ₦850 = `85000`. Field names end in `Kobo`. Show as naira. The designs show `$`; the backend is naira only. |
| Dates | ISO 8601 UTC strings: `"2026-11-09T12:27:24.615Z"` |
| Locations | `{ "lat": 6.4474, "lng": 3.4553 }` |
| Phone | E.164: `"+2348031234567"` |
| IDs | Opaque strings. Order numbers for display: `"ORD-2026-0392"` (`orderNumber`). |
| Lists | `?limit=20&cursor=…` → `data: { "items": [ … ], "nextCursor": "…" or null }` |

### Files (photos, CAC/NIN documents, licences)

1. `POST /uploads` `{ "purpose": "product_photo" | "store_logo" | "store_cover" | "kyc_document" | "avatar" | "chat_attachment" | "delivery_proof", "contentType": "image/jpeg", "sizeBytes": 123456 }` → `data: { "uploadUrl", "fileId", "expiresAt" }` ✅
2. `PUT` the file bytes to `uploadUrl` with the same `Content-Type`.
3. Send `fileId` in the request that uses the file (e.g. a product's `photoFileIds`).

Limits: images JPG/PNG/WebP up to 5 MB; documents JPG/PNG/PDF up to 10 MB (as in the designs).

### Live data (Firestore, read only)

Some screens must update by themselves: order tracking, the rider's position, chat, new-order alerts, wallet balance. For these, listen to the Firestore document named in the screen's section with `snapshots()`. The app **never writes** to Firestore; security rules refuse it. All changes go through the API.

---

## 3. Accounts, sign-in and onboarding (all three apps)

Figma: *Onboarding 1–3, Create account, Choose Your Role, Verify your phone number, Login, What are you shopping for today?*

### Sign-in

All sign-in happens in the app with Firebase Authentication; the API never sees passwords.

| Design element | Firebase call |
| --- | --- |
| Continue with Google | `GoogleSignIn` → `signInWithCredential` |
| Continue with Apple | `SignInWithApple` → `signInWithCredential` (required on iOS if Google is offered) |
| Email + password | `createUserWithEmailAndPassword` / `signInWithEmailAndPassword` |
| Verify your phone number (4-digit screens) | `verifyPhoneNumber` → `PhoneAuthProvider.credential` → `linkWithCredential`. **Firebase sends 6-digit codes; the OTP boxes must take 6.** Test numbers: +234 800 000 0001 → `111111`, +234 800 000 0002 → `222222`. |
| Forgot password | `sendPasswordResetEmail` |

### After sign-in

1. `GET /me`. If `data.profile` is `null`, the person has an account but no profile: show **Choose Your Role**.
2. `POST /me` with the role and name: this is the end of sign-up. Buyers go straight in; sellers and riders continue to their verification steps.
3. Register the device for push notifications (`POST /me/devices`, section 12).

| Endpoint | Status | Notes |
| --- | --- | --- |
| `GET /health` *public* | ✅ | |
| `GET /me` | ✅ (shape below from Stage 1) | Profile, role, verification status, store or rider summary |
| `POST /me` | ✅ (shape below from Stage 1) | Register: `{ "role": "buyer"\|"seller"\|"rider", "name", "email"?, "phone"? }` → `201`. `409 conflict` if already registered. The role cannot be changed later. |
| `PATCH /me` | ✅ | `{ "name"?, "phone"?, "email"?, "avatarFileId"? }` (Edit Profile) |
| `PATCH /me/preferences` | ✅ | `{ "shoppingMode": "restaurants"\|"farm"\|"all" }` (What are you shopping for today? / Skip) and notification settings: `{ "notifications": { "orderUpdates": true, "promotions": false, "news": false, "sms": true } }` |
| `DELETE /me` | ✅ | Delete account (store requirement) |

`GET /me` response (from Stage 1):

```json
{
  "uid": "Xk2…", "email": "amaka@example.com", "phone": "+2348031234567",
  "profile": {
    "role": "seller", "name": "Amaka Osei", "avatarUrl": null,
    "status": "active",
    "verificationStatus": "pending",
    "shoppingMode": "all",
    "walletBalanceKobo": 245000,
    "createdAt": "2026-01-15T09:00:00.000Z"
  },
  "store": { "id": "s9F…", "name": "Green Valley Farm", "verificationStatus": "pending" },
  "rider": null
}
```

- `status`: `active` · `suspended` · `banned` (suspended/banned accounts get `account_disabled` everywhere).
- `verificationStatus`: buyers `not_required`; sellers and riders `incomplete` (steps not finished) → `pending` (waiting for admin, "You're all set!" screen) → `approved` (can trade) or `rejected` (show `verificationNote` and let them fix and resubmit).
- Listen to `users/{uid}` to switch screens the moment an admin approves.

### Seller verification (SELLER VIEW → Create account, steps 1–4)

| Step | Endpoint | Status | Body |
| --- | --- | --- | --- |
| 1 Tell us about your business | `PUT /seller/store` | ✅ | `{ "name", "ownerLegalName", "type": "farm"\|"restaurant"\|"vendor", "businessType": "Cooperative", "description"?, "phone"?, "address": { "line", "city", "state" }, "location": { "lat", "lng" } }` |
| 2–3 Verify your business (CAC, NIN) | `PUT /seller/documents` | ✅ | `{ "cacFileId", "ninFileId" }` (upload first, section 2) |
| 4 Set up your payout account | `PUT /me/payout-account` | ✅ | see Payouts below |
| Submit ("You're all set!") | `POST /seller/submit` | ✅ | Moves to `pending`; admins review in the admin app |
| Edit Business / Contact Information | `PATCH /seller/store` | ✅ | Same fields as step 1, plus `logoFileId`, `coverFileId`, `isOpen`, `openingHours` |

`openingHours`: `{ "mon": { "open": "08:00", "close": "18:00" }, …, "sun": null }` (null = closed). Times are Lagos time.

### Rider verification (DRIVER → Create account, steps 1–5)

| Step | Endpoint | Status | Body |
| --- | --- | --- | --- |
| 1 Your personal details | `PUT /rider/profile` | ✅ | `{ "legalName", "dateOfBirth": "1995-04-12", "address": { "line", "city", "state" } }` |
| 2–3 Upload your credentials | `PUT /rider/documents` | ✅ | `{ "driversLicenceFileId", "ninFileId" }` |
| 4 Your vehicle details | `PUT /rider/vehicle` | ✅ | `{ "type": "motorcycle"\|"bicycle"\|"car"\|"van", "plateNumber", "color", "makeModel", "year": 2022 }` |
| 5 Set up your payout account | `PUT /me/payout-account` | ✅ | see below |
| Submit | `POST /rider/submit` | ✅ | Moves to `pending` |

### Payouts (sellers and riders)

| Endpoint | Status | Notes |
| --- | --- | --- |
| `GET /banks` *public* | ✅ | Nigerian banks for the bank picker: `[{ "code": "058", "name": "GTBank" }]` |
| `POST /banks/resolve` | ✅ | `{ "bankCode", "accountNumber" }` → `{ "accountName" }`. Show the name for the user to confirm ("We'll verify the account"). |
| `PUT /me/payout-account` | ✅ | `{ "bankCode", "accountNumber" }`. The server resolves and stores the verified name; it cannot be typed in. |

### Saved addresses (buyer Profile → Saved Addresses)

| Endpoint | Status | Notes |
| --- | --- | --- |
| `GET /me/addresses` | ✅ | |
| `POST /me/addresses` | ✅ | `{ "label": "Home", "line": "45 Admiralty Way", "area": "Lekki Phase 1", "city": "Lagos", "state": "Lagos", "location": { "lat", "lng" }, "instructions"?: "Gate code 4421", "isDefault"?: true }` |
| `PATCH /me/addresses/{id}` · `DELETE /me/addresses/{id}` | ✅ | "Set as Default" is `PATCH { "isDefault": true }` |

"Use current location": get coordinates with `geolocator`, turn them into an address with the Google Geocoding API in the app, and send both.

### Settings screen

| Design | Where |
| --- | --- |
| Notifications toggles | `PATCH /me/preferences` |
| Change Password | Firebase `user.updatePassword` after `reauthenticateWithCredential` |
| Biometric Login | Device only (`local_auth`); nothing on the server |
| Two-Factor Auth | Firebase multi-factor (SMS) in the app |
| FAQs, Email Us, Rate the App | `GET /config` (public) returns `supportEmail`, `faqs`, store links ✅ |
| Live Chat | Support conversation, section 10 |
| Sign Out | `POST /me/devices/{id}/remove` (stop pushes), then Firebase `signOut()` |

---

## 4. Browsing: stores, products, search (buyer)

Figma: *HOMEPAGE, RESTAURANT SCREEN, RESTUARANT PAGE, PRODUCT DETAIL PAGE, FILTER PAGE, WISHLIST, Categories, Flash deals*

All ✅ live. Browsing is public (no token needed) so the app can show the shop before sign-in; with a token, `isWishlisted` is filled in.

| Endpoint | Screen | Notes |
| --- | --- | --- |
| `GET /categories` | Categories row, Filter → Categories | `[{ "id", "name", "icon", "mode": "farm"\|"restaurants" }]` |
| `GET /home?mode=farm&lat=&lng=` | Homepage | One call for the whole home screen: banner(s) ("Farm Fresh Daily"), categories, flash deals, popular products, nearby restaurants ("5 restaurants nearby") |
| `GET /stores?type=restaurant&lat=&lng=&cursor=` | "See all", Food Near You | Store cards: `name`, `tagline`, `logoUrl`, `coverUrl`, `rating`, `ratingCount`, `etaMinutes: { "min": 25, "max": 35 }`, `distanceKm`, `isOpenNow`, `highlights: ["Jollof Rice", "Suya"]` |
| `GET /stores/{id}` | Restaurant / farm page | Store detail plus `menuSections: [{ "id", "name": "Rice Dishes" }]`, `openingHours`, `isOpenNow`, seller `isOnline` ("Online now") |
| `GET /stores/{id}/products?section=&cursor=` | Menu tabs (All, Rice Dishes, …, Popular) | |
| `GET /products/{id}` | Product detail | `name`, `photos[]`, `category`, `priceKobo`, `unit` ("per kg"), `stock`, `inStock`, `soldCount` ("340+ Sold"), `deliveryEstimate` ("1d"), `prepMinutes` (restaurants, "15 min"), `description`, `highlights[]` ("No pesticides…"), `rating`, `ratingCount`, `store` summary |
| `GET /products/{id}/reviews?cursor=` | Reviews tab | `[{ "rating", "comment", "buyerName", "createdAt" }]` |
| `GET /search?q=&mode=&category=&minPriceKobo=&maxPriceKobo=&farmType=organic\|local\|imported&inStock=true&maxDeliveryHours=&minRating=&deals=true&sort=relevance\|price_asc\|price_desc\|rating\|newest&cursor=` | Search found, Filter & Sort | Returns `total` ("24 Items found") and `items`. Empty `items` = "No products found" state. |
| `GET /search/suggestions?q=` | Result Suggestions while typing | |
| `GET /search/popular` | Popular Searches | Recent Searches are stored on the device only |
| `GET /me/wishlist` · `PUT /me/wishlist/{productId}` · `DELETE /me/wishlist/{productId}` | Wishlist heart, Wishlist screen ("4 Items saved") | |

---

## 5. Seller: products and store (SELLER VIEW)

Figma: *MY PRODUCTS SELLERS VIEW, ADD PRODUCT, DELETE PRODUCT, SELLERS DASHBOARD*

Only **approved** sellers can publish. All ✅ live.

| Endpoint | Screen | Notes |
| --- | --- | --- |
| `GET /seller/products?status=all\|published\|draft&q=&cursor=` | My Products (tabs with counts) | `data.counts: { "all": 8, "published": 6, "draft": 2 }` |
| `POST /seller/products` | Add New Product | `{ "name", "categoryId", "priceKobo", "unit": "kg"\|"bag"\|"bunch"\|"bundle"\|"piece"\|"plate"\|"litre", "stock", "lowStockThreshold"?: 3, "description"?, "photoFileIds": [], "menuSectionId"?, "prepMinutes"?, "farmType"?, "highlights"?: [], "status": "draft"\|"published" }` |
| `PATCH /seller/products/{id}` | Edit (pencil) | Any field above, e.g. `{ "stock": 40 }` or `{ "status": "published" }` |
| `DELETE /seller/products/{id}` | Delete Product? | Products in open orders are hidden instead of deleted |
| `GET /seller/menu-sections` · `POST` · `PATCH /{id}` · `DELETE /{id}` | Restaurant menu tabs | |
| `PATCH /seller/store` | Open / closed toggle, opening hours | `{ "isOpen": false }` |

---

## 6. Cart, checkout and payment (buyer)

Figma: *MY CART, Delivery Details, Payment Method, Order Summary, Bank Transfer, Order Placed, RESTAURANT CHECK OUT FLOW*

All ✅ live. The cart is stored on the server so it survives reinstalling and is the same on every device.

**One order per store.** If the cart holds items from two stores, checkout creates two orders (paid together, one payment).

| Endpoint | Screen | Notes |
| --- | --- | --- |
| `GET /cart` | Cart | Items grouped by store, each with `priceKobo`, `quantity`, `lineTotalKobo`, `available` (false if out of stock or the store closed), and `totals` |
| `PUT /cart/items/{productId}` | Add to Cart, quantity −/+ | `{ "quantity": 2 }`; `0` removes |
| `DELETE /cart` | Clear | |
| `POST /cart/promo` | Promo code box + Apply | `{ "code": "FRESH10" }` → updated totals or `validation_failed` |
| `POST /checkout/quote` | Delivery Details → Order Summary | `{ "addressId" or "address", "deliverySlot": "asap"\|"today_12_14"\|"today_16_18"\|"tomorrow_morning", "note"?: "≤200 chars" }` → `{ "subtotalKobo", "deliveryFeeKobo", "serviceFeeKobo", "discountKobo", "totalKobo", "deliverySlots": [ … available slots … ] }` |
| `POST /checkout` | Place order / Pay | `{ …quote fields…, "paymentMethod": "card"\|"bank_transfer"\|"wallet", "savedCardId"?, "splitId"? }` → see below |
| `GET /payments/{reference}` | Processing Payment → Payment Successful / Unsuccessful | `{ "status": "pending"\|"success"\|"failed", "orderIds": [ … ] }` |

**What `POST /checkout` returns:**

- `wallet`: paid at once from the wallet balance → `{ "status": "success", "orderIds": […] }` → **Order Placed** screen. `402 payment_required` if the balance is too low.
- `card` (new card): `{ "status": "pending", "reference", "authorizationUrl", "accessCode" }`. Open Paystack checkout with `accessCode` (or the URL in a web view). When it closes, poll `GET /payments/{reference}` every 2 s for up to 60 s.
- `card` with `savedCardId`: charged directly → `success`, or `pending` if the bank asks for OTP (then open `authorizationUrl`).
- `bank_transfer`: `{ "status": "pending", "reference", "bankName", "accountNumber", "accountName", "amountKobo", "expiresAt" }`. Show it on the **Bank Transfer** screen ("Transfer exactly …", Copy). The account is a one-time Paystack account for this payment; poll `GET /payments/{reference}`.

**The app never decides a payment succeeded.** Paystack tells our server; the order only exists as *placed* after that. A Paystack screen saying "success" while the API still says `pending` means waiting a few seconds.

**Escrow:** the money is held until the buyer confirms delivery (section 7), then released to the seller (minus commission) and the rider. This is what "Payment Protected", "Escrow Held" and "Escrow Released" show.

### Saved cards (Profile → Payment Methods)

✅. A card is saved automatically the first time it is used successfully (Paystack authorization; we never see the full card number).

| Endpoint | Notes |
| --- | --- |
| `GET /me/cards` | `[{ "id", "brand": "visa", "last4": "4521", "expMonth": 9, "expYear": 2027, "bank": "Zenith Bank", "isDefault" }]` |
| `PATCH /me/cards/{id}` `{ "isDefault": true }` · `DELETE /me/cards/{id}` | Set Default, Remove |
| `POST /me/cards` | "Add Card": starts a ₦50 Paystack authorization that is refunded, returns `accessCode` like checkout |

The **Enter Card Details** screen in the design should be replaced by Paystack's own card form: card numbers must not pass through our app or server.

---

## 7. Orders: buyer side

Figma: *My Orders, Order Status (tracking map), Delivery Confirmed!, Rate your experience, EMPTY STATES*

All ✅ live.

### Order status

The six steps on the tracking screen are the order's `status`:

| `status` | Tracking step | Set by |
| --- | --- | --- |
| `placed` | Order Placed | Payment confirmed |
| `confirmed` | Order Confirmed | Seller taps Accept |
| `preparing` | Being Prepared | Seller |
| `ready_for_pickup` | Ready for Pickup | Seller ("Mark as Ready for Pickup") |
| `out_for_delivery` | Out for Delivery | Rider ("Items Picked Up") |
| `delivered` | Delivered | Rider marks delivered → buyer confirms |

Other states: `cancelled` (by buyer before `confirmed`, or seller Reject → full refund to the buyer's wallet or card), `disputed` (buyer reported a problem; admin decides).

Payment state (`escrowStatus`): `held` → `released` (seller and rider paid) or `refunded`.

| Endpoint | Screen | Notes |
| --- | --- | --- |
| `GET /orders?status=active\|completed\|all&cursor=` | My Orders | Card: `orderNumber`, `createdAt`, `itemCount`, `status`, `step: { "index": 5, "of": 6, "label": "Out for Delivery" }`, `totalKobo`, `escrowStatus` |
| `GET /orders/{id}` | Order detail | Items, address, fees, `timeline: [{ "status", "at" }]` (the times on the tracking screen), `store`, `rider` (name, photo, phone, vehicle, rating) once assigned, `canCancel`, `canConfirm` |
| `POST /orders/{id}/cancel` | | Only while `placed` |
| `POST /orders/{id}/confirm-delivery` | Delivery Confirmed! | Releases escrow. If the buyer does nothing, it releases automatically 48 hours after the rider marks it delivered. |
| `POST /orders/{id}/review` | Rate your experience | `{ "storeRating": 5, "riderRating": 5, "comment"?, "productRatings"?: [{ "productId", "rating" }] }` |
| `POST /orders/{id}/report` | Report a problem | `{ "reason": "wrong_items"\|"missing_items"\|"quality"\|"late"\|"other", "description", "photoFileIds"? }` → opens a dispute for the admin team |

### Live tracking map

Listen to **`orders/{orderId}`** (Firestore). It holds `status`, `timeline`, and while a rider is on the way:

```json
"tracking": { "riderLocation": { "lat": 6.45, "lng": 3.43 }, "heading": 120, "target": "store" | "buyer", "updatedAt": "…", "distanceKm": 1.2, "etaMinutes": 8 }
```

- Draw the store, the delivery address and the rider's pin with `google_maps_flutter`; move the pin as the document changes.
- The route line and "1.2 km to pickup" come from `distanceKm`. To draw the road route, call the Google Directions API from the app (a separate Maps key restricted to your app).

---

## 8. Orders: seller side (SELLER VIEW)

Figma: *New Order Notification (Seller), SELLERS DASHBOARD, Recent Orders, tabs New / In Progress / Ready / Completed*

All ✅ live.

| Endpoint | Screen | Notes |
| --- | --- | --- |
| `GET /seller/orders?status=new\|in_progress\|ready\|completed&cursor=` | All Orders tabs | `data.counts` for the tab badges |
| `GET /seller/orders/{id}` | Order card / detail | Buyer name and area, items, note ("Please make sure the tomatoes are firm"), `totalKobo`, `escrowStatus` |
| `POST /seller/orders/{id}/accept` | Accept Order | `placed` → `confirmed` |
| `POST /seller/orders/{id}/reject` | Reject → Are you sure? | `{ "reason" }` → buyer refunded |
| `POST /seller/orders/{id}/preparing` | | `confirmed` → `preparing` |
| `POST /seller/orders/{id}/ready` | Mark as Ready for Pickup | Riders nearby are offered the job |
| `GET /seller/dashboard` | Dashboard | `todayEarningsKobo`, `monthEarningsKobo`, `todayOrders`, `todayOrdersChangePct` ("+12%"), `pendingOrders`, `activeProducts`, `lowStockItems`, `weeklySales: [{ "day": "mon", "amountKobo" }]`, `recentOrders[]` |

**New-order pop-up:** a push notification (`type: "new_order"`, with `orderId`). While the app is open, also refresh `GET /seller/orders?status=new` when that push arrives (or every 30 s on the orders screen).

---

## 9. Delivery: rider app (DRIVER)

Figma: *DRIVER'S DASHBOARD, DRIVER ACTIVE DELIVERY FLOW, Delivery Complete, EARNINGS, You're offline*

All ✅ live. Only approved riders.

| Endpoint | Screen | Notes |
| --- | --- | --- |
| `POST /rider/online` · `POST /rider/offline` | Online toggle / "You're offline" | Online riders get job offers |
| `POST /rider/location` | (background) | `{ "lat", "lng", "heading"?, "speed"? }`. Send every 10 s while online and every 5 s on an active delivery. This updates the buyer's tracking map. |
| `GET /rider/dashboard` | Dashboard header | `name`, `rating`, `tripCount`, today's `deliveries`, `earningsKobo`, `distanceKm` |
| `GET /rider/jobs` | Available Jobs | Jobs near the rider: `orderNumber`, pickup (store name, address, location), drop-off (buyer first name, area, location), `distanceKm`, `payKobo`, `bonusKobo` ("+₦50 bonus"), `paymentProtected`, `expiresAt` |
| `POST /rider/jobs/{orderId}/accept` · `/decline` | Accept Job / Decline | First rider to accept gets it (`409 conflict` for the others) |
| `GET /rider/deliveries?status=active\|completed&cursor=` | My Deliveries | |
| `POST /rider/deliveries/{orderId}/arrived-at-store` | Arrived at Seller | |
| `POST /rider/deliveries/{orderId}/picked-up` | Items Picked Up | Order → `out_for_delivery` |
| `POST /rider/deliveries/{orderId}/delivered` | Delivered | `{ "proofPhotoFileId"?, "dropOffCode"? }`. Order → `delivered`; the buyer is asked to confirm. |
| `GET /rider/earnings?range=week\|month\|all` | My Earnings | `totalCareerKobo`, `weekTotalKobo`, `byDay[]`, `transactions[]` (order, buyer, pay, bonus, status `paid`/`pending`) |

The rider's pay for a delivery (delivery pay + bonus) is credited to their wallet when the buyer confirms, as on "Delivery Complete". If the buyer never confirms, the order is released automatically 48 hours after delivery (checked once a day).

Job offers arrive as push notifications (`type: "job_offer"`, with `orderId`). While Available Jobs is open, refresh `GET /rider/jobs` when that push arrives (or every 15 s).

---

## 10. Messages and support (all apps)

Figma: *MESSAGE SCREEN, USER CHATTING WITH SELLER, Message empty states, Help & Support*

All ✅ live. Voice/video calls (*INCOMING CALL, Voice Call / Switch to Video*) are **not planned for now**: hide the call buttons.

Each order has up to three threads: buyer↔seller, buyer↔rider and seller↔rider (the rider ones once a rider has accepted the job). Support (buyer, seller or rider ↔ Vorapicks admins) is one thread per person, answered from the admin website.

| Endpoint | Notes |
| --- | --- |
| `GET /conversations?type=buyer\|seller\|rider\|support&cursor=` | Message list tabs (buyers: Seller / Driver / Admin). Each item: `id`, `type` (the other side's role), `counterpart` (`name`, `photoUrl`, `role`), `orderNumber`, `lastMessage` (`text`, `mine`), `lastMessageAt`, `unreadCount`, `closed`. Also `totalUnread` and `unreadByType` for the tab badges. |
| `POST /conversations` | `{ "orderId", "with": "seller"\|"rider"\|"buyer" }` or `{ "type": "support", "orderId"? }` → the existing or a new conversation (same shape as a list item) |
| `GET /conversations/{id}` | Chat header |
| `GET /conversations/{id}/messages?limit=30&cursor=` | Newest first. Each: `id`, `mine`, `senderRole`, `text`, `attachmentUrl` (short-lived link), `createdAt`, `time` ("10:22 AM"). Pass `nextCursor` to load older ones. |
| `POST /conversations/{id}/messages` | `{ "text"?, "attachmentFileId"?, "clientId": "uuid" }`. Upload attachments first with purpose `chat_attachment`. Re-sending the same `clientId` (e.g. after a timeout) is safe: it is stored once. |
| `POST /conversations/{id}/read` | Clears the unread badge; call when the chat opens and when a new message arrives while it is open |

The other side gets a push `type: "message"` with `conversationId` and `orderId`.

**Live:**
- Order chats: listen to `chats/{conversationId}/messages` ordered by `createdAt`. Each document: `senderId`, `text`, `attachmentFileId`, `createdAt`. (Use `GET …/messages` for attachment links.)
- Support: listen to the document `conversations/support-{yourUid}`; its `messages` array grows as admins reply.
- Unread badge on the Messages tab: `users/{uid}/inbox/summary` → `unread`.

---

## 11. Wallet, top-up and withdrawals

Figma: *VORAPICKS WALLET, ADD MONEY TO VORAPICK WALLET, CREDIT/DEBIT HISTORY, Withdraw Earnings, Withdrawal Initiated!*

All ✅ live.

| Endpoint | Screen | Notes |
| --- | --- | --- |
| `GET /wallet` | Wallet header | `balanceKobo`, `totalAddedKobo`, `topUpCount`, `totalSpentKobo`, `orderCount`, `pendingKobo` (sellers/riders: money waiting for buyer confirmation) |
| `GET /wallet/transactions?type=all\|credit\|debit&cursor=` | Wallet History, credit/debit tabs | `[{ "id", "type": "credit"\|"debit", "kind": "top_up"\|"order_payment"\|"refund"\|"sale"\|"delivery_pay"\|"bonus"\|"withdrawal"\|"split_share", "amountKobo", "description": "Order #ORD-2026-0388 Payment", "createdAt" }]` |
| `POST /wallet/top-up` | Add Money → Continue | `{ "amountKobo": 500000, "method": "card"\|"bank_transfer", "savedCardId"? }`. Same flow as checkout; minimum ₦100. |
| `POST /wallet/withdraw` | Withdraw Earnings | Sellers and riders: `{ "amountKobo" }` to the verified payout account. Fee shown first via `GET /wallet/withdraw/quote?amountKobo=`. |
| `GET /wallet/withdrawals` | | `status`: `processing` → `paid` or `failed` (money returned to the wallet) |

**Live balance:** `users/{uid}` has `walletBalanceKobo`.

---

## 12. Notifications

Figma: *Alerts (seller), New Order Received, Split the bill pop-up, incoming call*

| Endpoint | Status | Notes |
| --- | --- | --- |
| `POST /me/devices` | ✅ | `{ "token": "<FCM token>", "platform": "android"\|"ios" }` on every launch and when the token refreshes |
| `POST /me/devices/{id}/remove` | ✅ | On sign-out |
| `GET /notifications?cursor=` | ✅ | In-app list (Alerts): `title`, `body`, `type`, `data`, `read`, `createdAt` |
| `POST /notifications/read` | ✅ | `{ "ids": [ … ] }` or `{ "all": true }` |

Every push carries `data.type` and IDs so a tap opens the right screen:

| `type` | Who gets it | Open |
| --- | --- | --- |
| `order_status` | Buyer | Order tracking (`orderId`) |
| `new_order` | Seller | Seller order (`orderId`) |
| `job_offer` | Nearby riders | Available Jobs (`orderId`) |
| `message` | Anyone | Conversation (`conversationId`) |
| `split_invite`, `split_update` | Split participants | Split the bill (`splitId`) |
| `shopping_request`, `shopping_suggestions` | Sellers / buyer | Personal shopping (`requestId`) |
| `payment` | Anyone | Wallet / order |
| `verification` | Sellers, riders | Account status |
| `payout` | Sellers, riders | Wallet |

---

## 13. Split the bill (buyer)

Figma: *SPLIT THE BILL SCREEN, Split the Bill Invitation Flow, Group Orders, Split History, 2 Split Requests Pending*

All ✅ live.

1. The organiser builds the cart, taps **Split the Bill**, picks a method and adds people (Vorapicks users, found by email or phone).
2. `POST /splits` `{ "method": "equal"\|"custom"\|"percent", "participants": [{ "email"\|"phone", "amountKobo"\|"percent" }], "addressId", "deliverySlot"?, "note"? }` (the delivery fields are the same as `POST /checkout`, without `paymentMethod`) → split with each person's share; invitations go out (push `split_invite`).
3. Each person (organiser included) pays their own share: `POST /splits/{id}/pay` `{ "paymentMethod", "savedCardId"? }` (same payment flow as checkout).
4. Invitees can `POST /splits/{id}/accept` or `/decline`. A declined share moves to the organiser.
5. When every share is paid the order is placed automatically and the items leave the organiser's cart. If it isn't fully paid in **24 hours** (or the organiser taps **Cancel Split**: `POST /splits/{id}/cancel`), everyone who paid is refunded to their wallet.

| Endpoint | Screen |
| --- | --- |
| `GET /splits?role=organiser\|invited&status=active\|done` | Group Orders, Split History, "2 Split Requests Pending" |
| `GET /splits/{id}` | Split the bill page: participants with `status` (`pending`, `accepted`, `paid`, `declined`), `paidKobo` / `totalKobo` ("₦16,000 / ₦24,000"), joined count ("2 / 4") |

Live: `splits/{id}` in Firestore.

---

## 14. Personal shopping (buyer ↔ sellers)

Figma: *BUYER REQUEST FOR PERSONAL SHOPPER, Make a Shopping Request, Request Submitted!, PERSONAL SHOPPERS (seller)*

All ✅ live.

| Endpoint | Who | Notes |
| --- | --- | --- |
| `POST /shopping-requests` | Buyer | `{ "description": "5–500 chars", "budgetKobo"?, "neededBy": "2026-11-12T16:00:00+01:00", "addressId" }` (at least 30 min ahead) → sent to the nearest sellers who deliver there; `data.sellersNotified` |
| `GET /shopping-requests` · `GET /shopping-requests/{id}` | Buyer | Status `open` → `suggestions_received` → `accepted` / `closed` (closed automatically once `neededBy` passes). Detail has `offers[]`: `seller` (`id`, `name`, `logoUrl`), `suggestions[]` (`id`, `name`, `priceKobo`, `unit`, `note`, `photoUrl`), `totalKobo` |
| `POST /shopping-requests/{id}/accept` | Buyer | `{ "sellerId", "suggestionIds": [ … ], "quantities"?: { "<suggestionId>": 2 } }` → those items go into the cart (returned as `data.cart`), then normal checkout |
| `POST /shopping-requests/{id}/close` | Buyer | No longer needed |
| `GET /seller/shopping-requests?status=pending\|sent\|approved&cursor=` | Seller | Tabs with `data.counts`. Each: `buyer.name`, `description`, `area`, `budgetKobo`, `neededBy`, `status` (`pending`, `sent`, `approved`, `not_selected`, `closed`), the seller's own `suggestions[]`, `totalKobo`. `GET /seller/shopping-requests/{id}` for one. |
| `POST /seller/shopping-requests/{id}/suggestions` | Seller | `{ "name": "Red Onions (2kg)", "priceKobo", "unit", "note"?: "Large and firm", "productId"? }`. `productId` links one of the seller's published products; otherwise a one-off item is made for this buyer only. Editable until sent. |
| `DELETE /seller/shopping-requests/{id}/suggestions/{sid}` | Seller | |
| `POST /seller/shopping-requests/{id}/send` | Seller | Sends the suggestions to the buyer (push `shopping_suggestions`) |

The resulting order then follows the normal seller order flow (New → Accept → In Progress → Ready → Completed).

---

## 15. Build stages and launch checklist

| Stage | Contents | Status |
| --- | --- | --- |
| 1 | Accounts: unified profile and roles, seller store details, rider personal and vehicle details, payout bank accounts, addresses, preferences, devices, config | ✅ |
| 2 | File uploads; seller and rider documents; submit for verification; admin review screens | ✅ (needs Firebase Storage, below) |
| 3 | Catalog: categories, stores, products, menus, search and filters, wishlist, reviews; seller product management | ✅ |
| 4 | Cart, checkout, Paystack payments (card, bank transfer, wallet), escrow, saved cards, wallet and top-up | ✅ |
| 5 | Orders: buyer, seller and admin order flow, timeline, confirm delivery, cancel, refunds, reviews, disputes, notifications | ✅ |
| 6 | Riders: online status, location, job offers, delivery steps, live tracking, earnings, withdrawals | ✅ |
| 7 | Chat: order conversations and support | ✅ |
| 8 | Split the bill; personal shopping | ✅ |
| 9 | Voice/video calls; Vora AI assistant | Not planned for now |

Before launch (Vorapicks team):
- **Firebase Storage** must be switched on in the Firebase console; until then `POST /uploads` fails.
- **Firestore rules** for the live feeds above are published with `pnpm db:rules`.
- **Paystack:** the webhook URL `https://vorapicks.com/api/v1/paystack/webhook` is set in the Paystack dashboard (test and live). Test with Paystack's test cards first. Card checks charge ₦50, which goes to the buyer's wallet.
- **Housekeeping** (auto-release after 48 h, expiring splits, closing old shopping requests) runs once a day via Vercel Cron and needs the `CRON_SECRET` environment variable in Vercel.

## 16. Open questions (for the business owner)

| Question | Default until decided |
| --- | --- |
| Commission on each sale | 10% of the subtotal |
| Service fee charged to buyers | ₦50 per order |
| Delivery fee | ₦500 base + ₦100 per km beyond 3 km |
| Rider pay per delivery | 80% of the delivery fee, plus bonuses set by admins |
| Delivery area | Lagos only |
| Phone SMS verification | Firebase phone auth (paid per SMS beyond the free allowance) |

These numbers live in admin settings, not in the app: the app always shows the fees the API returns.
