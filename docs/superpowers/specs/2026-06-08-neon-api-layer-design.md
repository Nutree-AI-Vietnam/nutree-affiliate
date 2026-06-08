# Neon API Layer Design

**Date:** 2026-06-08
**Project:** Nutree Affiliate Portal

---

## Overview

Add Vercel serverless API routes (`/api/*`) to the existing React + Vite project. These routes connect to Neon (PostgreSQL) and serve as the data layer for the affiliate portal. Firebase Auth (Google Sign-In) is already in place — the frontend sends a Firebase JWT with every request, and the API verifies it server-side using the Firebase Admin SDK.

PT accounts are **separate from the main Nutree app users** — stored in a new `affiliates` table. Existing Neon tables (`referral_codes`, `referral_wallets`, `referral_conversions`, `payout_requests`) are reused as-is.

---

## Architecture

### New files

| File | Purpose |
|---|---|
| `api/_lib/db.ts` | Neon connection pool, exported as `sql` tagged template |
| `api/_lib/auth.ts` | Firebase Admin JWT verification, returns `{ uid, name, email }` |
| `api/affiliate/me.ts` | `GET` — profile + referral code, auto-creates on first call |
| `api/affiliate/stats.ts` | `GET` — wallet balance + conversion counts |
| `api/affiliate/payouts.ts` | `GET` — payout request history |
| `api/affiliate/bank-info.ts` | `GET` + `POST` — read/save bank details |
| `api/admin/overview.ts` | `GET` — all affiliates summary (admin only) |
| `api/admin/[id]/mark-paid.ts` | `POST` — mark affiliate payouts paid (admin only) |

### Packages to install

```
@neondatabase/serverless   — Neon HTTP driver (edge-compatible)
firebase-admin             — JWT verification server-side
```

---

## Neon Schema

### New table

```sql
CREATE TABLE affiliates (
  id           VARCHAR PRIMARY KEY,
  firebase_uid VARCHAR UNIQUE NOT NULL,
  name         VARCHAR NOT NULL,
  email        VARCHAR NOT NULL,
  role         VARCHAR NOT NULL DEFAULT 'pt',  -- 'pt' | 'admin'
  bank_info    JSON,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);
```

### Reused tables (no changes)

| Table | Key columns used |
|---|---|
| `referral_codes` | `user_id` → `affiliates.id`, `code` |
| `referral_wallets` | `user_id` → `affiliates.id`, `balance`, `total_earned`, `total_withdrawn` |
| `referral_conversions` | `referrer_user_id` → `affiliates.id`, `status`, `commission_amount_vnd` |
| `payout_requests` | `user_id` → `affiliates.id`, `amount`, `status`, `payment_details`, `admin_note` |

---

## API Endpoints

### `GET /api/affiliate/me`

Returns the PT's profile and referral code. **Auto-creates** the affiliate record on first call (idempotent).

**First-login transaction:**
1. Check `affiliates` by `firebase_uid`
2. If not found → in a single transaction:
   - `INSERT INTO affiliates` (id = UUID, firebase_uid, name, email, role = 'pt')
   - `INSERT INTO referral_codes` (user_id = affiliate.id, code = first 8 chars of UUID uppercased, unique-checked)
   - `INSERT INTO referral_wallets` (user_id = affiliate.id, balance = 0, total_earned = 0, total_withdrawn = 0)
3. Return affiliate + referral code

**Response:**
```json
{
  "affiliateId": "uuid",
  "name": "Alex Nguyen",
  "email": "alex@example.com",
  "role": "pt",
  "referralCode": "AB12CD34",
  "referralLink": "https://nutree.app/r/AB12CD34"
}
```

---

### `GET /api/affiliate/stats`

Reads wallet + conversion counts for the authenticated PT.

**Query:**
- `referral_wallets` → `balance`, `total_earned`, `total_withdrawn`
- `referral_conversions` grouped by `status` → count trials and active subscriptions

**Response:**
```json
{
  "balance": 900000,
  "totalEarned": 1200000,
  "totalWithdrawn": 300000,
  "pendingTrials": 2,
  "activeSubscriptions": 4
}
```

---

### `GET /api/affiliate/payouts`

Returns payout request history for the authenticated PT.

**Response:**
```json
[
  {
    "id": "payout-uuid",
    "amount": 300000,
    "status": "paid",
    "paymentMethod": "bank_transfer",
    "paymentDetails": { "bankName": "VCB", "accountNumber": "..." },
    "requestedAt": "2026-05-01T00:00:00Z",
    "completedAt": "2026-05-03T00:00:00Z",
    "adminNote": null
  }
]
```

---

### `GET /api/affiliate/bank-info`

Returns saved bank info from the affiliate's `bank_info` JSON column. Returns `null` if not set.

---

### `POST /api/affiliate/bank-info`

Saves bank info to `affiliates.bank_info`.

**Request body:**
```json
{
  "bankName": "VCB",
  "accountHolder": "NGUYEN VAN A",
  "accountNumber": "1234567890"
}
```

---

### `GET /api/admin/overview` _(admin only)_

Returns all affiliates with their stats. Rejects with `403` if `role != 'admin'`.

**Response:**
```json
{
  "totalRevenue": 5000000,
  "totalPayoutOwed": 3000000,
  "activeAffiliates": 12,
  "commissionPerConversion": 300000,
  "affiliates": [
    {
      "affiliateId": "uuid",
      "name": "Alex",
      "code": "AB12CD34",
      "pendingTrials": 1,
      "activeSubscriptions": 3,
      "totalEarned": 900000,
      "balance": 600000,
      "hasBankInfo": true,
      "lastPaidDate": "2026-05-03"
    }
  ]
}
```

---

### `POST /api/admin/[id]/mark-paid` _(admin only)_

Marks all pending `payout_requests` for the given affiliate as `paid`, sets `completed_at = NOW()`.

---

## Auth Middleware (`api/_lib/auth.ts`)

Every route calls `verifyAuth(req)` before any DB work:

```typescript
// Returns { uid, name, email } or throws 401
async function verifyAuth(req: VercelRequest): Promise<{ uid: string; name: string; email: string }>
```

- Reads `Authorization: Bearer <token>` header
- Verifies with Firebase Admin SDK (`admin.auth().verifyIdToken(token)`)
- Returns decoded claims or throws with status 401

Admin routes additionally call `requireAdmin(affiliateId)` which checks `affiliates.role = 'admin'`, throws 403 if not.

---

## Error Handling

All routes return `{ error: string }` JSON with appropriate HTTP status:

| Scenario | Status |
|---|---|
| Missing/invalid token | 401 |
| Non-admin on admin route | 403 |
| Affiliate not found | 404 |
| DB error | 500 (generic message, no SQL details) |
| Invalid request body | 400 |

---

## Environment Variables

| Variable | Where |
|---|---|
| `DATABASE_URL` | Neon connection string (server-side only, never `VITE_` prefixed) |
| `FIREBASE_SERVICE_ACCOUNT` | Firebase Admin SDK service account JSON (stringified) |

Both added to Vercel env vars (production) and `.env.local` (development, gitignored).

---

## Out of Scope

- Frontend wiring (Spec 2 — replace `firebaseApi.ts` with fetch calls)
- Promo code creation in `promo_codes` table (separate spec)
- Payout request creation by PT (separate spec)
- Commission rate configuration UI
