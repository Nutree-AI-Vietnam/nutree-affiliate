# Firebase Google Auth Design

**Date:** 2026-06-07  
**Project:** Nutree Affiliate Portal  

---

## Overview

Replace the existing mock email/password login with Google Sign-In via Firebase Auth. All affiliate data (referral codes, stats, bank info, payouts) moves from the mock API to Firestore. The existing `AffiliateApi` interface is preserved — a new `FirebaseApi` class implements it, swapped in at the provider level.

---

## Architecture

### New files
- `src/lib/firebase.ts` — Firebase app init, exports `auth` (FirebaseAuth) and `db` (Firestore)
- `src/api/firebaseApi.ts` — `FirebaseApi` class implementing `AffiliateApi`

### Modified files
- `src/main.tsx` — swap `MockApi` provider for `FirebaseApi`
- `src/pages/Login.tsx` — remove email/password form; replace `SignInView` with a single Google sign-in button
- `src/types/index.ts` — no changes needed; `Session` fields map cleanly to Firebase user + Firestore doc

### Firestore collections

| Collection | Document | Fields |
|---|---|---|
| `affiliates` | `{uid}` | `name`, `email`, `role`, `referralCode`, `referralLink`, `bankInfo?` |
| `conversions` | `{uid}/entries/{id}` | conversion records |
| `payouts` | `{uid}/entries/{id}` | payout records |
| `settings` | `commission` | `commissionPerConversion` |

---

## Sign-In Flow

1. User clicks "Sign in with Google" on the login page
2. `signInWithPopup(GoogleAuthProvider)` opens the Google OAuth popup
3. On success, check if `affiliates/{uid}` exists in Firestore
4. **New user** → create the doc: `role: "pt"`, generate unique referral code, save `name` and `email` from Google profile
5. **Returning user** → load the existing doc
6. Build `Session` from Firestore doc, call `saveSession()`, navigate to `/pt`

Admin role is assigned manually in the Firebase console by setting `role: "admin"` on the affiliate doc. No UI for this.

---

## Error Handling

| Scenario | Behavior |
|---|---|
| Google popup cancelled/closed | Silently ignore, no error shown |
| Google sign-in network/provider error | Inline error message on login page |
| Firestore write fails on new user creation | Show error, stay on login (do not navigate) |
| Firestore read fails on data pages | Page shows error state (existing pattern) |
| Session expired / invalid token | `clearSession()` + redirect to `/` via existing auth guard |

---

## Auth Guard

`src/auth/guard.tsx` reads from `localStorage` — no changes required. The existing session flow is preserved.

---

## What Stays the Same

- `AffiliateApi` interface — unchanged
- `src/auth/session.ts` — unchanged (`saveSession`, `loadSession`, `clearSession`)
- `src/auth/guard.tsx` — unchanged
- Mock API — kept for tests

---

## Out of Scope

- Email/password login (removed entirely)
- Firebase Cloud Functions
- Approval flow for new affiliates (open registration: all Google sign-ins get `role: "pt"`)
- Firebase Hosting (deployment stays on Vercel)
