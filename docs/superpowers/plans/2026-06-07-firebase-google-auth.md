# Firebase Google Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace mock email/password login with Google Sign-In via Firebase Auth, backed by Firestore for all affiliate data.

**Architecture:** A new `FirebaseApi` class implements the existing `AffiliateApi` interface and is swapped in at the provider level in `main.tsx`. The `Login` page is simplified to a single "Sign in with Google" button. All data reads/writes use Firestore collections (`affiliates`, `conversions`, `payouts`, `settings`).

**Tech Stack:** Firebase Auth (GoogleAuthProvider, signInWithPopup), Firestore, React, TypeScript, Vite

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `src/lib/firebase.ts` | **Create** | Firebase app init, exports `auth` and `db` |
| `src/api/firebaseApi.ts` | **Create** | `FirebaseApi` class implementing `AffiliateApi` |
| `src/main.tsx` | **Modify** | Swap `MockApi` for `FirebaseApi` |
| `src/pages/Login.tsx` | **Modify** | Replace sign-in form with Google button |
| `src/pages/Register.tsx` | **Delete** | No longer needed — Google handles registration |
| `src/App.tsx` | **Modify** | Remove `/register` route |
| `src/pages/__tests__/Login.test.tsx` | **Modify** | Update tests for Google sign-in UI |
| `.env.local` | **Create** | Firebase config env vars (not committed) |

---

## Task 1: Install Firebase and add env vars

**Files:**
- Modify: `package.json` (via npm)
- Create: `.env.local`
- Create: `.gitignore` entry for `.env.local`

- [ ] **Step 1: Install Firebase SDK**

```bash
npm install firebase
```

Expected output: `added N packages`

- [ ] **Step 2: Create `.env.local` with Firebase config**

Go to [Firebase Console](https://console.firebase.google.com) → your project → Project Settings → Web app → SDK setup. Copy the config values into:

```
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

- [ ] **Step 3: Ensure `.env.local` is gitignored**

Check `.gitignore` already contains `.env.local`. If not, add it:

```
.env.local
```

- [ ] **Step 4: Enable Google Sign-In in Firebase Console**

Firebase Console → Authentication → Sign-in method → Google → Enable → Save.

- [ ] **Step 5: Enable Firestore in Firebase Console**

Firebase Console → Firestore Database → Create database → Start in **test mode** (you'll add security rules later) → select region → Done.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json .gitignore
git commit -m "chore: install firebase sdk"
```

---

## Task 2: Create `src/lib/firebase.ts`

**Files:**
- Create: `src/lib/firebase.ts`

- [ ] **Step 1: Create the file**

```typescript
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/firebase.ts
git commit -m "feat: initialize firebase app, auth, and firestore"
```

---

## Task 3: Create `src/api/firebaseApi.ts`

**Files:**
- Create: `src/api/firebaseApi.ts`

This implements all `AffiliateApi` methods using Firestore. The `login()` method triggers Google sign-in and creates the affiliate doc on first sign-in.

- [ ] **Step 1: Create the file**

```typescript
import {
  signInWithPopup, signOut, type User,
} from "firebase/auth";
import {
  doc, getDoc, setDoc, updateDoc, collection, getDocs,
} from "firebase/firestore";
import { auth, googleProvider, db } from "../lib/firebase";
import type { AffiliateApi } from "./index";
import type {
  Session, MyStats, ReferralInfo, BankInfo, Payout, AdminOverview, AffiliateRow,
} from "../types";

function generateReferralCode(uid: string): string {
  return uid.slice(0, 8).toUpperCase();
}

function currentUid(): string {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  return user.uid;
}

export function createFirebaseApi(): AffiliateApi {
  return {
    async login(): Promise<Session> {
      const result = await signInWithPopup(auth, googleProvider);
      const user: User = result.user;
      const uid = user.uid;
      const ref = doc(db, "affiliates", uid);
      const snap = await getDoc(ref);

      if (!snap.exists()) {
        const referralCode = generateReferralCode(uid);
        await setDoc(ref, {
          name: user.displayName ?? "Affiliate",
          email: user.email ?? "",
          role: "pt",
          referralCode,
          referralLink: `https://nutree.app/r/${referralCode}`,
          bankInfo: null,
        });
      }

      const data = (await getDoc(ref)).data()!;
      return {
        affiliateId: uid,
        name: data.name,
        email: data.email,
        role: data.role,
      };
    },

    async register(): Promise<Session> {
      // Registration happens through login() via Google — this method is unused
      throw new Error("Use Google Sign-In");
    },

    async logout(): Promise<void> {
      await signOut(auth);
    },

    async getMyStats(): Promise<MyStats> {
      const uid = currentUid();
      const convSnap = await getDocs(collection(db, "conversions", uid, "entries"));
      const paySnap = await getDocs(collection(db, "payouts", uid, "entries"));
      const settingSnap = await getDoc(doc(db, "settings", "commission"));
      const commission: number = settingSnap.exists()
        ? settingSnap.data().commissionPerConversion
        : 300000;

      let pendingTrials = 0;
      let activeSubscriptions = 0;
      convSnap.forEach((d) => {
        const c = d.data();
        if (c.status === "trial") pendingTrials++;
        if (c.status === "active") activeSubscriptions++;
      });

      const totalRevenue = activeSubscriptions * commission;

      let lastPaymentDate: string | null = null;
      let totalPayout = 0;
      paySnap.forEach((d) => {
        const p = d.data();
        if (p.status === "paid") {
          totalPayout += p.amount ?? 0;
          if (!lastPaymentDate || p.paidDate > lastPaymentDate) {
            lastPaymentDate = p.paidDate;
          }
        }
      });

      return { totalRevenue, totalPayout, pendingTrials, activeSubscriptions, lastPaymentDate };
    },

    async getMyReferral(): Promise<ReferralInfo> {
      const uid = currentUid();
      const snap = await getDoc(doc(db, "affiliates", uid));
      if (!snap.exists()) throw new Error("Affiliate not found");
      const data = snap.data();
      return { code: data.referralCode, link: data.referralLink };
    },

    async getMyBankInfo(): Promise<BankInfo | null> {
      const uid = currentUid();
      const snap = await getDoc(doc(db, "affiliates", uid));
      if (!snap.exists()) return null;
      return snap.data().bankInfo ?? null;
    },

    async saveBankInfo(info: BankInfo): Promise<BankInfo> {
      const uid = currentUid();
      await updateDoc(doc(db, "affiliates", uid), { bankInfo: info });
      return info;
    },

    async getMyPayouts(): Promise<Payout[]> {
      const uid = currentUid();
      const snap = await getDocs(collection(db, "payouts", uid, "entries"));
      return snap.docs.map((d) => d.data() as Payout);
    },

    async getAdminOverview(): Promise<AdminOverview> {
      const affSnap = await getDocs(collection(db, "affiliates"));
      const settingSnap = await getDoc(doc(db, "settings", "commission"));
      const commissionPerConversion: number = settingSnap.exists()
        ? settingSnap.data().commissionPerConversion
        : 300000;

      const rows: AffiliateRow[] = [];
      let totalRevenue = 0;
      let totalPayoutOwed = 0;
      let pendingTrials = 0;
      let activeSubscriptions = 0;

      for (const affDoc of affSnap.docs) {
        const uid = affDoc.id;
        const aff = affDoc.data();
        const convSnap = await getDocs(collection(db, "conversions", uid, "entries"));

        let affPending = 0;
        let affActive = 0;
        convSnap.forEach((d) => {
          const c = d.data();
          if (c.status === "trial") affPending++;
          if (c.status === "active") affActive++;
        });

        const affRevenue = affActive * commissionPerConversion;
        const affPayoutOwed = affActive * commissionPerConversion;
        pendingTrials += affPending;
        activeSubscriptions += affActive;
        totalRevenue += affRevenue;
        totalPayoutOwed += affPayoutOwed;

        const paySnap = await getDocs(collection(db, "payouts", uid, "entries"));
        let lastPaidDate: string | null = null;
        paySnap.forEach((d) => {
          const p = d.data();
          if (p.status === "paid" && (!lastPaidDate || p.paidDate > lastPaidDate)) {
            lastPaidDate = p.paidDate;
          }
        });

        rows.push({
          affiliateId: uid,
          name: aff.name,
          code: aff.referralCode,
          pendingTrials: affPending,
          activeSubscriptions: affActive,
          totalRevenue: affRevenue,
          payoutOwed: affPayoutOwed,
          hasBankInfo: !!aff.bankInfo,
          lastPaidDate,
        });
      }

      return {
        totalRevenue,
        totalPayoutOwed,
        activeAffiliates: rows.length,
        pendingTrials,
        activeSubscriptions,
        commissionPerConversion,
        affiliates: rows,
      };
    },

    async markPayoutPaid(affiliateId: string): Promise<void> {
      const paySnap = await getDocs(collection(db, "payouts", affiliateId, "entries"));
      const today = new Date().toISOString().slice(0, 10);
      for (const payDoc of paySnap.docs) {
        if (payDoc.data().status === "pending") {
          await updateDoc(payDoc.ref, { status: "paid", paidDate: today });
        }
      }
    },

    async getCommissionSetting(): Promise<{ commissionPerConversion: number }> {
      const snap = await getDoc(doc(db, "settings", "commission"));
      return { commissionPerConversion: snap.exists() ? snap.data().commissionPerConversion : 300000 };
    },
  };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/api/firebaseApi.ts
git commit -m "feat: implement FirebaseApi with Google auth and Firestore"
```

---

## Task 4: Update `src/main.tsx` to use `FirebaseApi`

**Files:**
- Modify: `src/main.tsx`

- [ ] **Step 1: Replace mock API with Firebase API**

Replace the entire content of `src/main.tsx` with:

```typescript
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import { ApiContext } from "./api";
import { createFirebaseApi } from "./api/firebaseApi";
import { ThemeProvider } from "./lib/ThemeContext";
import "./index.css";

const api = createFirebaseApi();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <ApiContext.Provider value={api}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ApiContext.Provider>
    </ThemeProvider>
  </React.StrictMode>
);
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/main.tsx
git commit -m "feat: swap MockApi for FirebaseApi in provider"
```

---

## Task 5: Update `src/pages/Login.tsx` — replace form with Google button

**Files:**
- Modify: `src/pages/Login.tsx`

Keep the full landing page (`LandingView`, `EarningsCalculator`, `WhyNutree`) intact. Replace only `SignInView` and the `submit` function with a Google sign-in button.

- [ ] **Step 1: Replace `SignInView` component and `submit` logic**

In `src/pages/Login.tsx`:

1. Remove the `SignInView` function entirely.
2. Replace the `submit` function and state variables (`email`, `password`) with:

```typescript
const [error, setError] = useState("");
const [loading, setLoading] = useState(false);

async function signInWithGoogle() {
  setError("");
  setLoading(true);
  try {
    const session = await api.login("", "");
    saveSession(session);
    navigate(session.role === "admin" ? "/admin" : "/pt");
  } catch (err: unknown) {
    // Popup closed by user — ignore
    if (err instanceof Error && err.message.includes("popup-closed")) return;
    setError(err instanceof Error ? err.message : "Đăng nhập thất bại");
  } finally {
    setLoading(false);
  }
}
```

3. Replace the `SignInView` usage in the render with a new inline component:

```tsx
{step === "landing" ? (
  <LandingView onApply={() => setStep("signin")} />
) : (
  <div className="relative z-10 flex flex-col gap-5 px-6 py-10 animate-[slideUp_0.5s_ease_both]" style={{ animationFillMode: "both" }}>
    <div>
      <span className="block font-mono text-xs font-medium uppercase tracking-widest text-[#29B6A1]">
        Nutree Affiliates
      </span>
      <h1 className="mt-3 text-4xl font-medium leading-[1.1] tracking-[-0.8px] text-neutral-800 dark:text-white">
        Chào mừng trở lại
      </h1>
      <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
        Đăng nhập để xem dashboard của bạn
      </p>
    </div>

    <div className="rounded-xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-[#2D2D2D] p-6 shadow-sm flex flex-col gap-4">
      {error && (
        <p className="rounded-xl bg-red-50 dark:bg-red-900/20 px-4 py-2.5 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      <button
        onClick={signInWithGoogle}
        disabled={loading}
        className="group flex h-11 w-full items-center justify-center gap-2.5 rounded-lg border border-neutral-200 dark:border-white/10 bg-white dark:bg-[#1F1F1F] px-4 text-sm font-semibold text-neutral-800 dark:text-white transition-all hover:bg-neutral-50 dark:hover:bg-white/5 hover:ring-2 hover:ring-neutral-200 dark:hover:ring-white/10 active:scale-[.98] disabled:opacity-50"
      >
        <svg className="size-5" viewBox="0 0 24 24">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        {loading ? "Đang đăng nhập…" : "Đăng nhập với Google"}
      </button>
    </div>
  </div>
)}
```

4. Remove the now-unused `email`, `setEmail`, `password`, `setPassword` state variables and the `Link` import if no longer used.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/pages/Login.tsx
git commit -m "feat: replace email/password login with Google sign-in button"
```

---

## Task 6: Remove Register page and route

**Files:**
- Delete: `src/pages/Register.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Check what routes exist in App.tsx**

Read `src/App.tsx` and locate the `/register` route.

- [ ] **Step 2: Remove the `/register` route from `src/App.tsx`**

Remove the line(s) that import `Register` and define the `/register` route. Example — if you see:

```tsx
import { Register } from "./pages/Register";
// ...
<Route path="/register" element={<Register />} />
```

Delete both lines.

- [ ] **Step 3: Delete the Register page file**

```bash
rm src/pages/Register.tsx
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: remove register page, registration now happens via Google sign-in"
```

---

## Task 7: Update Login tests

**Files:**
- Modify: `src/pages/__tests__/Login.test.tsx`

The existing tests fill in email/password fields that no longer exist. Replace them with tests for the new Google sign-in button.

- [ ] **Step 1: Replace the test file content**

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { ApiContext } from "../../api";
import type { AffiliateApi } from "../../api";
import { createMockApi } from "../../api/mockApi";
import { Login } from "../Login";

function makeMockApiWithGoogle(overrides: Partial<AffiliateApi> = {}): AffiliateApi {
  return { ...createMockApi(), ...overrides };
}

function setup(api: AffiliateApi = makeMockApiWithGoogle()) {
  return render(
    <ApiContext.Provider value={api}>
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/pt" element={<div>pt dashboard</div>} />
          <Route path="/admin" element={<div>admin overview</div>} />
        </Routes>
      </MemoryRouter>
    </ApiContext.Provider>
  );
}

describe("Login", () => {
  it("shows the Google sign-in button after clicking Đăng nhập", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: /đăng nhập/i }));
    expect(screen.getByRole("button", { name: /đăng nhập với google/i })).toBeInTheDocument();
  });

  it("navigates to /pt on successful Google sign-in as PT", async () => {
    const api = makeMockApiWithGoogle({
      login: vi.fn().mockResolvedValue({
        affiliateId: "uid1", name: "Alex", email: "alex@test.com", role: "pt",
      }),
    });
    setup(api);
    await userEvent.click(screen.getByRole("button", { name: /đăng nhập/i }));
    await userEvent.click(screen.getByRole("button", { name: /đăng nhập với google/i }));
    await waitFor(() => expect(screen.getByText("pt dashboard")).toBeInTheDocument());
  });

  it("navigates to /admin on successful Google sign-in as admin", async () => {
    const api = makeMockApiWithGoogle({
      login: vi.fn().mockResolvedValue({
        affiliateId: "uid2", name: "Admin", email: "admin@test.com", role: "admin",
      }),
    });
    setup(api);
    await userEvent.click(screen.getByRole("button", { name: /đăng nhập/i }));
    await userEvent.click(screen.getByRole("button", { name: /đăng nhập với google/i }));
    await waitFor(() => expect(screen.getByText("admin overview")).toBeInTheDocument());
  });

  it("shows an error when sign-in fails", async () => {
    const api = makeMockApiWithGoogle({
      login: vi.fn().mockRejectedValue(new Error("auth/network-request-failed")),
    });
    setup(api);
    await userEvent.click(screen.getByRole("button", { name: /đăng nhập/i }));
    await userEvent.click(screen.getByRole("button", { name: /đăng nhập với google/i }));
    await waitFor(() =>
      expect(screen.getByText(/auth\/network-request-failed/i)).toBeInTheDocument()
    );
  });

  it("does not show an error when popup is closed by user", async () => {
    const api = makeMockApiWithGoogle({
      login: vi.fn().mockRejectedValue(new Error("popup-closed")),
    });
    setup(api);
    await userEvent.click(screen.getByRole("button", { name: /đăng nhập/i }));
    await userEvent.click(screen.getByRole("button", { name: /đăng nhập với google/i }));
    await waitFor(() =>
      expect(screen.queryByText(/popup-closed/i)).not.toBeInTheDocument()
    );
  });
});
```

- [ ] **Step 2: Run the tests**

```bash
npm test -- --run src/pages/__tests__/Login.test.tsx
```

Expected: all 5 tests pass

- [ ] **Step 3: Run the full test suite**

```bash
npm test -- --run
```

Expected: all tests pass (tests that used email/password directly are replaced; other page tests should still pass since they don't depend on Login)

- [ ] **Step 4: Commit**

```bash
git add src/pages/__tests__/Login.test.tsx
git commit -m "test: update Login tests for Google sign-in flow"
```

---

## Task 8: Add Firestore security rules

**Files:**
- Create: `firestore.rules`

Security rules prevent unauthorized reads/writes. Set these in the Firebase Console under Firestore → Rules.

- [ ] **Step 1: Create `firestore.rules` for reference**

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Affiliates can read/write their own doc
    match /affiliates/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }

    // Affiliates can read their own conversions and payouts
    match /conversions/{uid}/entries/{entryId} {
      allow read: if request.auth != null && request.auth.uid == uid;
      allow write: if false; // written by backend only
    }

    match /payouts/{uid}/entries/{entryId} {
      allow read: if request.auth != null && request.auth.uid == uid;
      allow write: if false; // written by backend only
    }

    // Commission settings readable by all authenticated users
    match /settings/commission {
      allow read: if request.auth != null;
      allow write: if false; // admin-only via console
    }
  }
}
```

- [ ] **Step 2: Paste these rules into Firebase Console**

Firebase Console → Firestore Database → Rules tab → paste the rules above → Publish.

- [ ] **Step 3: Commit the rules file for version control**

```bash
git add firestore.rules
git commit -m "chore: add firestore security rules"
```

---

## Task 9: Manual smoke test

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Test the happy path**

1. Open `http://localhost:5173`
2. Click "Đăng nhập" → Google sign-in button appears
3. Click "Đăng nhập với Google" → Google OAuth popup opens
4. Sign in with a Google account
5. Expected: redirected to `/pt` dashboard

- [ ] **Step 3: Test returning user**

Sign out (clear localStorage or use the app logout), sign in again with the same Google account. Expected: same referral code, no duplicate Firestore doc created.

- [ ] **Step 4: Verify Firestore**

Firebase Console → Firestore → `affiliates` collection → confirm the doc was created with correct `name`, `email`, `role: "pt"`, `referralCode`.
