# Neon API Wiring Design (Spec 2)

**Date:** 2026-06-08
**Project:** Nutree Affiliate Portal

---

## Overview

Replace the Firestore data layer (`firebaseApi.ts`) with direct calls to the new Vercel serverless API routes (`/api/*`). Firebase Auth is kept for identity (login/logout). All affiliate data now flows exclusively through Neon via the API layer.

---

## Architecture

### New file

| File | Purpose |
|---|---|
| `src/api/neonApi.ts` | Full `AffiliateApi` implementation using `fetch()` to `/api/*` |
| `src/api/__tests__/neonApi.test.ts` | Unit tests — mocks `fetch` and Firebase `getIdToken` |

### Modified files

| File | Change |
|---|---|
| `src/main.tsx` | Swap `createFirebaseApi()` → `createNeonApi()` |
| `src/api/index.ts` | Update `login()` signature to `login(): Promise<Session>` |

### Deleted files

| File | Reason |
|---|---|
| `src/api/firebaseApi.ts` | Replaced entirely by `neonApi.ts` |

---

## Auth Flow

Login and logout use Firebase Auth unchanged:
- `login()` — calls `signInWithPopup(auth, googleProvider)`, then calls `GET /api/affiliate/me` with the resulting token to auto-create the Neon record and return the full `Session`.
- `logout()` — calls `signOut(auth)`.

Every other method calls `authFetch()` which:
1. Gets the current Firebase JWT via `auth.currentUser!.getIdToken()`
2. Attaches `Authorization: Bearer <token>` header
3. Returns the parsed JSON response
4. On `401`: calls `logout()` then throws (token expired mid-session)
5. On non-2xx: throws with a generic error message

---

## Method Mapping

| `AffiliateApi` method | HTTP call | Notes |
|---|---|---|
| `login()` | `signInWithPopup` + `GET /api/affiliate/me` | Firebase Auth + auto-create in Neon |
| `logout()` | `signOut(auth)` | Firebase Auth only |
| `getMyStats()` | `GET /api/affiliate/stats` + `GET /api/affiliate/payouts` | Extra payouts call for `lastPaymentDate` |
| `getMyReferral()` | `GET /api/affiliate/me` | Extract `referralCode` + `referralLink` |
| `getMyBankInfo()` | `GET /api/affiliate/bank-info` | Returns `null` if unset |
| `saveBankInfo()` | `POST /api/affiliate/bank-info` | Body: `{ bankName, accountHolder, accountNumber }` |
| `getMyPayouts()` | `GET /api/affiliate/payouts` | Maps to `Payout[]` |
| `getAdminOverview()` | `GET /api/admin/overview` | Maps to `AdminOverview` |
| `markPayoutPaid()` | `POST /api/admin/[id]/mark-paid` | No body needed |
| `getCommissionSetting()` | `GET /api/admin/overview` | Extracts `commissionPerConversion` |

---

## Type Mapping (Neon → Frontend)

### `getMyStats()` → `MyStats`

```
AffiliateStats.totalEarned       → MyStats.totalRevenue
AffiliateStats.totalWithdrawn    → MyStats.totalPayout
AffiliateStats.pendingTrials     → MyStats.pendingTrials
AffiliateStats.activeSubscriptions → MyStats.activeSubscriptions
payouts (latest paid completedAt) → MyStats.lastPaymentDate
```

### `getMyPayouts()` → `Payout[]`

```
PayoutRequest.requestedAt (formatted "May 2026") → Payout.period
0                                                 → Payout.conversions  (not tracked per payout)
PayoutRequest.amount                              → Payout.amount
PayoutRequest.status                              → Payout.status
PayoutRequest.completedAt                         → Payout.paidDate
```

### `getAdminOverview()` → `AdminOverview`

```
AdminOverview.totalRevenue                        → AdminOverview.totalRevenue
AdminOverview.totalPayoutOwed                     → AdminOverview.totalPayoutOwed
AdminOverview.activeAffiliates                    → AdminOverview.activeAffiliates
sum(affiliates.pendingTrials)                     → AdminOverview.pendingTrials
sum(affiliates.activeSubscriptions)               → AdminOverview.activeSubscriptions
AdminOverview.commissionPerConversion             → AdminOverview.commissionPerConversion
affiliates (see AffiliateRow mapping below)       → AdminOverview.affiliates
```

### `AdminAffiliateRow` → `AffiliateRow`

```
AdminAffiliateRow.affiliateId      → AffiliateRow.affiliateId
AdminAffiliateRow.name             → AffiliateRow.name
AdminAffiliateRow.code             → AffiliateRow.code
AdminAffiliateRow.pendingTrials    → AffiliateRow.pendingTrials
AdminAffiliateRow.activeSubscriptions → AffiliateRow.activeSubscriptions
AdminAffiliateRow.totalEarned      → AffiliateRow.totalRevenue
AdminAffiliateRow.balance          → AffiliateRow.payoutOwed
AdminAffiliateRow.hasBankInfo      → AffiliateRow.hasBankInfo
AdminAffiliateRow.lastPaidDate     → AffiliateRow.lastPaidDate
```

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| No current user when calling `authFetch` | Throw `"Not authenticated"` |
| API returns `401` | Call `logout()` then throw `"Session expired"` |
| API returns `404` | Return empty value (null, `[]`) rather than throwing |
| API returns `5xx` | Throw `"Something went wrong. Please try again."` |
| Network error | Propagate original error |

---

## Interface Change

`AffiliateApi.login` signature updated from:
```typescript
login(email: string, password: string): Promise<Session>
```
to:
```typescript
login(): Promise<Session>
```

`register()` remains in the interface as a no-op that throws `"Use Google Sign-In"` (existing behaviour).

---

## Testing

`src/api/__tests__/neonApi.test.ts` covers:

- `login()` — mocks `signInWithPopup` + `fetch` for `/api/affiliate/me`, returns correct `Session`
- `getMyStats()` — mocks `fetch` for stats + payouts, verifies type mapping
- `getMyReferral()` — mocks `fetch` for `/api/affiliate/me`, returns `{ code, link }`
- `getMyBankInfo()` — null when API returns `null`, BankInfo when set
- `saveBankInfo()` — verifies POST body and returns saved info
- `getMyPayouts()` — verifies `Payout[]` shape mapping
- `getAdminOverview()` — verifies `AdminOverview` shape including derived fields
- `markPayoutPaid()` — verifies correct URL called
- `authFetch` on 401 — verifies `logout()` is called

---

## Out of Scope

- Payout request creation by PT (separate spec)
- Commission rate configuration UI (separate spec)
- Any changes to UI components (zero changes needed — `AffiliateApi` interface preserved)
