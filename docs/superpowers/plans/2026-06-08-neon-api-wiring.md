# Neon API Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Firestore data layer with `fetch()` calls to `/api/*`, keeping Firebase Auth for login/logout.

**Architecture:** Create `src/api/neonApi.ts` implementing `AffiliateApi`. A shared `authFetch()` helper attaches the Firebase JWT to every request. All type mapping (Neon API shapes → frontend types) happens inside `neonApi.ts`. Swap it into `main.tsx`, delete `firebaseApi.ts`.

**Tech Stack:** Firebase Auth (`getIdToken`), `fetch` API, Vitest + `vi.stubGlobal` for fetch mocking

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `src/api/neonApi.ts` | Create | Full `AffiliateApi` implementation using `/api/*` |
| `src/api/__tests__/neonApi.test.ts` | Create | Unit tests with mocked `fetch` |
| `src/api/index.ts` | Modify | Update `login()` signature |
| `src/main.tsx` | Modify | Swap to `createNeonApi()` |
| `src/api/firebaseApi.ts` | Delete | Replaced by `neonApi.ts` |

---

## Task 1: Update `AffiliateApi` interface — change `login()` signature

**Files:**
- Modify: `src/api/index.ts`

- [ ] **Step 1: Update the interface**

Replace the entire file content:

```typescript
// src/api/index.ts
import { createContext, useContext } from "react";
import type {
  Session, MyStats, ReferralInfo, BankInfo, Payout, AdminOverview,
} from "../types";

export interface AffiliateApi {
  login(): Promise<Session>;
  register(): Promise<Session>;
  logout(): Promise<void>;

  getMyStats(): Promise<MyStats>;
  getMyReferral(): Promise<ReferralInfo>;
  getMyBankInfo(): Promise<BankInfo | null>;
  saveBankInfo(info: BankInfo): Promise<BankInfo>;
  getMyPayouts(): Promise<Payout[]>;

  getAdminOverview(): Promise<AdminOverview>;
  markPayoutPaid(affiliateId: string, note?: string): Promise<void>;
  getCommissionSetting(): Promise<{ commissionPerConversion: number }>;
}

export const ApiContext = createContext<AffiliateApi | null>(null);

export function useApi(): AffiliateApi {
  const api = useContext(ApiContext);
  if (!api) throw new Error("useApi must be used within an ApiContext provider");
  return api;
}
```

- [ ] **Step 2: Fix callers — update mockApi to match new signature**

In `src/api/mockApi.ts`, find the `login` method signature and remove the parameters. The mock already ignores params, so just change:

```typescript
async login(_email: string, _password: string): Promise<Session> {
```
to:
```typescript
async login(): Promise<Session> {
```

Also update `register`:
```typescript
async register(): Promise<Session> {
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/truongle/nutree-affiliate
npx tsc -b --noEmit
```

Expected: no errors (some existing test files may call `api.login("email", "pass")` — those will need updating too; fix any that appear)

- [ ] **Step 4: Update mockApi tests to use new signature**

In `src/api/__tests__/mockApi.test.ts`, replace every `api.login("alex@pt.com", "password")` with `api.login()` and `api.login("admin@nutree.app", "admin")` with `api.login()`.

Since `mockApi` needs to know who to log in without credentials, update `mockApi.ts` to always return the first PT user by default (or keep a `setUser` helper for tests). The simplest fix: make the mock `login()` return the hardcoded PT session it already returns.

- [ ] **Step 5: Run tests**

```bash
npm test -- --run
```

Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add src/api/index.ts src/api/mockApi.ts src/api/__tests__/mockApi.test.ts
git commit -m "refactor: update AffiliateApi login/register signatures to no-arg"
```

---

## Task 2: Create `src/api/neonApi.ts` — auth + core helpers (TDD)

**Files:**
- Create: `src/api/neonApi.ts`
- Create: `src/api/__tests__/neonApi.test.ts`

- [ ] **Step 1: Write the failing test for `authFetch` and `login`**

```typescript
// src/api/__tests__/neonApi.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock firebase/auth module
vi.mock("firebase/auth", () => ({
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
  GoogleAuthProvider: vi.fn(),
}));

// Mock src/lib/firebase.ts
vi.mock("../../lib/firebase", () => ({
  auth: {
    currentUser: null as unknown,
  },
  googleProvider: {},
}));

import { signInWithPopup, signOut } from "firebase/auth";
import * as firebaseLib from "../../lib/firebase";
import { createNeonApi } from "../neonApi";

const mockSignIn = signInWithPopup as ReturnType<typeof vi.fn>;
const mockSignOut = signOut as ReturnType<typeof vi.fn>;

function setCurrentUser(user: { uid: string; displayName: string; email: string; getIdToken: () => Promise<string> } | null) {
  (firebaseLib.auth as Record<string, unknown>).currentUser = user;
}

function mockFetch(response: unknown, status = 200) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(response),
  }));
}

describe("neonApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setCurrentUser(null);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("login()", () => {
    it("signs in with Google and returns Session from /api/affiliate/me", async () => {
      const mockUser = {
        uid: "firebase-uid-1",
        displayName: "Alex",
        email: "alex@test.com",
        getIdToken: vi.fn().mockResolvedValue("test-token"),
      };
      mockSignIn.mockResolvedValue({ user: mockUser });
      setCurrentUser(mockUser);
      mockFetch({
        affiliateId: "aff-1",
        name: "Alex",
        email: "alex@test.com",
        role: "pt",
        referralCode: "ABCD1234",
        referralLink: "https://nutree.app/r/ABCD1234",
      });

      const api = createNeonApi();
      const session = await api.login();

      expect(session).toEqual({
        affiliateId: "aff-1",
        name: "Alex",
        email: "alex@test.com",
        role: "pt",
      });
    });
  });

  describe("logout()", () => {
    it("calls signOut", async () => {
      mockSignOut.mockResolvedValue(undefined);
      const api = createNeonApi();
      await api.logout();
      expect(mockSignOut).toHaveBeenCalledOnce();
    });
  });

  describe("authFetch on 401", () => {
    it("calls logout and throws on 401 response", async () => {
      const mockUser = {
        uid: "firebase-uid-1",
        displayName: "Alex",
        email: "alex@test.com",
        getIdToken: vi.fn().mockResolvedValue("expired-token"),
      };
      setCurrentUser(mockUser);
      mockSignOut.mockResolvedValue(undefined);
      mockFetch({ error: "Unauthorized" }, 401);

      const api = createNeonApi();
      await expect(api.getMyReferral()).rejects.toThrow("Session expired");
      expect(mockSignOut).toHaveBeenCalledOnce();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --run src/api/__tests__/neonApi.test.ts
```

Expected: FAIL — `createNeonApi` not found

- [ ] **Step 3: Create `src/api/neonApi.ts` with login, logout, authFetch**

```typescript
// src/api/neonApi.ts
import { signInWithPopup, signOut } from "firebase/auth";
import { auth, googleProvider } from "../lib/firebase";
import type { AffiliateApi } from "./index";
import type {
  Session, MyStats, ReferralInfo, BankInfo, Payout, AdminOverview, AffiliateRow,
} from "../types";

const BASE_URL = "/api";

async function authFetch<T>(
  path: string,
  options?: RequestInit,
  onLogout?: () => void,
): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  const token = await user.getIdToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  });
  if (res.status === 401) {
    if (onLogout) onLogout();
    await signOut(auth);
    throw new Error("Session expired");
  }
  if (!res.ok) {
    throw new Error("Something went wrong. Please try again.");
  }
  return res.json() as Promise<T>;
}

interface AffiliateProfile {
  affiliateId: string;
  name: string;
  email: string;
  role: string;
  referralCode: string;
  referralLink: string;
}

interface AffiliateStats {
  balance: number;
  totalEarned: number;
  totalWithdrawn: number;
  pendingTrials: number;
  activeSubscriptions: number;
}

interface PayoutRequest {
  id: string;
  amount: number;
  status: string;
  paymentMethod: string | null;
  paymentDetails: Record<string, string> | null;
  requestedAt: string;
  completedAt: string | null;
  adminNote: string | null;
}

interface AdminOverviewResponse {
  totalRevenue: number;
  totalPayoutOwed: number;
  activeAffiliates: number;
  commissionPerConversion: number;
  affiliates: {
    affiliateId: string;
    name: string;
    code: string;
    pendingTrials: number;
    activeSubscriptions: number;
    totalEarned: number;
    balance: number;
    hasBankInfo: boolean;
    lastPaidDate: string | null;
  }[];
}

export function createNeonApi(): AffiliateApi {
  return {
    async login(): Promise<Session> {
      const result = await signInWithPopup(auth, googleProvider);
      const profile = await authFetch<AffiliateProfile>("/affiliate/me");
      return {
        affiliateId: profile.affiliateId,
        name: profile.name,
        email: profile.email,
        role: profile.role as "pt" | "admin",
      };
    },

    async register(): Promise<Session> {
      throw new Error("Use Google Sign-In");
    },

    async logout(): Promise<void> {
      await signOut(auth);
    },

    async getMyStats(): Promise<MyStats> {
      const [stats, payouts] = await Promise.all([
        authFetch<AffiliateStats>("/affiliate/stats"),
        authFetch<PayoutRequest[]>("/affiliate/payouts"),
      ]);
      const lastPaid = payouts
        .filter((p) => p.status === "paid" && p.completedAt)
        .sort((a, b) => (b.completedAt! > a.completedAt! ? 1 : -1))[0];
      return {
        totalRevenue: stats.totalEarned,
        totalPayout: stats.totalWithdrawn,
        pendingTrials: stats.pendingTrials,
        activeSubscriptions: stats.activeSubscriptions,
        lastPaymentDate: lastPaid?.completedAt?.slice(0, 10) ?? null,
      };
    },

    async getMyReferral(): Promise<ReferralInfo> {
      const profile = await authFetch<AffiliateProfile>("/affiliate/me");
      return { code: profile.referralCode, link: profile.referralLink };
    },

    async getMyBankInfo(): Promise<BankInfo | null> {
      const result = await authFetch<BankInfo | null>("/affiliate/bank-info");
      return result;
    },

    async saveBankInfo(info: BankInfo): Promise<BankInfo> {
      return authFetch<BankInfo>("/affiliate/bank-info", {
        method: "POST",
        body: JSON.stringify(info),
      });
    },

    async getMyPayouts(): Promise<Payout[]> {
      const rows = await authFetch<PayoutRequest[]>("/affiliate/payouts");
      return rows.map((r) => {
        const date = new Date(r.requestedAt);
        const period = date.toLocaleString("default", { month: "long", year: "numeric" });
        return {
          period,
          conversions: 0,
          amount: r.amount,
          status: r.status as "pending" | "paid",
          paidDate: r.completedAt?.slice(0, 10) ?? null,
        };
      });
    },

    async getAdminOverview(): Promise<AdminOverview> {
      const data = await authFetch<AdminOverviewResponse>("/admin/overview");
      const affiliates: AffiliateRow[] = data.affiliates.map((a) => ({
        affiliateId: a.affiliateId,
        name: a.name,
        code: a.code,
        pendingTrials: a.pendingTrials,
        activeSubscriptions: a.activeSubscriptions,
        totalRevenue: a.totalEarned,
        payoutOwed: a.balance,
        hasBankInfo: a.hasBankInfo,
        lastPaidDate: a.lastPaidDate,
      }));
      return {
        totalRevenue: data.totalRevenue,
        totalPayoutOwed: data.totalPayoutOwed,
        activeAffiliates: data.activeAffiliates,
        pendingTrials: affiliates.reduce((s, a) => s + a.pendingTrials, 0),
        activeSubscriptions: affiliates.reduce((s, a) => s + a.activeSubscriptions, 0),
        commissionPerConversion: data.commissionPerConversion,
        affiliates,
      };
    },

    async markPayoutPaid(affiliateId: string): Promise<void> {
      await authFetch(`/admin/${affiliateId}/mark-paid`, { method: "POST" });
    },

    async getCommissionSetting(): Promise<{ commissionPerConversion: number }> {
      const data = await authFetch<AdminOverviewResponse>("/admin/overview");
      return { commissionPerConversion: data.commissionPerConversion };
    },
  };
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- --run src/api/__tests__/neonApi.test.ts
```

Expected: 3/3 pass

- [ ] **Step 5: Commit**

```bash
git add src/api/neonApi.ts src/api/__tests__/neonApi.test.ts
git commit -m "feat: add neonApi with authFetch, login, logout"
```

---

## Task 3: Add tests for data methods and verify full coverage

**Files:**
- Modify: `src/api/__tests__/neonApi.test.ts`

- [ ] **Step 1: Add tests for `getMyStats`, `getMyReferral`, `getMyBankInfo`, `saveBankInfo`, `getMyPayouts`**

Append to the `describe("neonApi")` block in `src/api/__tests__/neonApi.test.ts`:

```typescript
  describe("getMyStats()", () => {
    it("maps AffiliateStats + payouts to MyStats", async () => {
      const mockUser = {
        uid: "u1",
        displayName: "Alex",
        email: "alex@test.com",
        getIdToken: vi.fn().mockResolvedValue("tok"),
      };
      setCurrentUser(mockUser);

      vi.stubGlobal("fetch", vi.fn()
        .mockResolvedValueOnce({
          ok: true, status: 200,
          json: () => Promise.resolve({
            balance: 600000,
            totalEarned: 900000,
            totalWithdrawn: 300000,
            pendingTrials: 2,
            activeSubscriptions: 3,
          }),
        })
        .mockResolvedValueOnce({
          ok: true, status: 200,
          json: () => Promise.resolve([
            { id: "p1", amount: 300000, status: "paid", completedAt: "2026-05-03T00:00:00Z", requestedAt: "2026-05-01T00:00:00Z", paymentMethod: null, paymentDetails: null, adminNote: null },
          ]),
        })
      );

      const api = createNeonApi();
      const stats = await api.getMyStats();

      expect(stats.totalRevenue).toBe(900000);
      expect(stats.totalPayout).toBe(300000);
      expect(stats.pendingTrials).toBe(2);
      expect(stats.activeSubscriptions).toBe(3);
      expect(stats.lastPaymentDate).toBe("2026-05-03");
    });

    it("returns null lastPaymentDate when no paid payouts", async () => {
      const mockUser = {
        uid: "u1",
        displayName: "Alex",
        email: "alex@test.com",
        getIdToken: vi.fn().mockResolvedValue("tok"),
      };
      setCurrentUser(mockUser);

      vi.stubGlobal("fetch", vi.fn()
        .mockResolvedValueOnce({
          ok: true, status: 200,
          json: () => Promise.resolve({ balance: 0, totalEarned: 0, totalWithdrawn: 0, pendingTrials: 0, activeSubscriptions: 0 }),
        })
        .mockResolvedValueOnce({
          ok: true, status: 200,
          json: () => Promise.resolve([]),
        })
      );

      const api = createNeonApi();
      const stats = await api.getMyStats();
      expect(stats.lastPaymentDate).toBeNull();
    });
  });

  describe("getMyReferral()", () => {
    it("returns code and link from /api/affiliate/me", async () => {
      const mockUser = {
        uid: "u1",
        displayName: "Alex",
        email: "alex@test.com",
        getIdToken: vi.fn().mockResolvedValue("tok"),
      };
      setCurrentUser(mockUser);
      mockFetch({ affiliateId: "aff-1", name: "Alex", email: "alex@test.com", role: "pt", referralCode: "ABCD1234", referralLink: "https://nutree.app/r/ABCD1234" });

      const api = createNeonApi();
      const ref = await api.getMyReferral();
      expect(ref.code).toBe("ABCD1234");
      expect(ref.link).toBe("https://nutree.app/r/ABCD1234");
    });
  });

  describe("getMyBankInfo()", () => {
    it("returns null when bank info is not set", async () => {
      const mockUser = { uid: "u1", displayName: "Alex", email: "a@t.com", getIdToken: vi.fn().mockResolvedValue("tok") };
      setCurrentUser(mockUser);
      mockFetch(null);
      const api = createNeonApi();
      expect(await api.getMyBankInfo()).toBeNull();
    });

    it("returns bank info when set", async () => {
      const mockUser = { uid: "u1", displayName: "Alex", email: "a@t.com", getIdToken: vi.fn().mockResolvedValue("tok") };
      setCurrentUser(mockUser);
      const bankInfo = { bankName: "VCB", accountHolder: "ALEX", accountNumber: "123" };
      mockFetch(bankInfo);
      const api = createNeonApi();
      expect(await api.getMyBankInfo()).toEqual(bankInfo);
    });
  });

  describe("saveBankInfo()", () => {
    it("POSTs bank info and returns saved value", async () => {
      const mockUser = { uid: "u1", displayName: "Alex", email: "a@t.com", getIdToken: vi.fn().mockResolvedValue("tok") };
      setCurrentUser(mockUser);
      const bankInfo = { bankName: "VCB", accountHolder: "ALEX", accountNumber: "123" };
      mockFetch(bankInfo);
      const api = createNeonApi();
      const result = await api.saveBankInfo(bankInfo);
      expect(result).toEqual(bankInfo);
      const fetchCall = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(fetchCall[1].method).toBe("POST");
      expect(JSON.parse(fetchCall[1].body)).toEqual(bankInfo);
    });
  });

  describe("getMyPayouts()", () => {
    it("maps PayoutRequests to Payout[] with period formatted", async () => {
      const mockUser = { uid: "u1", displayName: "Alex", email: "a@t.com", getIdToken: vi.fn().mockResolvedValue("tok") };
      setCurrentUser(mockUser);
      mockFetch([{
        id: "p1", amount: 300000, status: "paid",
        requestedAt: "2026-05-01T00:00:00Z",
        completedAt: "2026-05-03T00:00:00Z",
        paymentMethod: null, paymentDetails: null, adminNote: null,
      }]);
      const api = createNeonApi();
      const payouts = await api.getMyPayouts();
      expect(payouts).toHaveLength(1);
      expect(payouts[0].amount).toBe(300000);
      expect(payouts[0].status).toBe("paid");
      expect(payouts[0].paidDate).toBe("2026-05-03");
      expect(payouts[0].conversions).toBe(0);
      expect(typeof payouts[0].period).toBe("string");
    });
  });
```

- [ ] **Step 2: Run tests**

```bash
npm test -- --run src/api/__tests__/neonApi.test.ts
```

Expected: all tests pass

- [ ] **Step 3: Commit**

```bash
git add src/api/__tests__/neonApi.test.ts
git commit -m "test: add neonApi data method tests"
```

---

## Task 4: Add tests for admin methods

**Files:**
- Modify: `src/api/__tests__/neonApi.test.ts`

- [ ] **Step 1: Add admin tests**

Append to the `describe("neonApi")` block:

```typescript
  describe("getAdminOverview()", () => {
    it("maps AdminOverviewResponse to AdminOverview with derived totals", async () => {
      const mockUser = { uid: "u1", displayName: "Admin", email: "admin@t.com", getIdToken: vi.fn().mockResolvedValue("tok") };
      setCurrentUser(mockUser);
      mockFetch({
        totalRevenue: 1200000,
        totalPayoutOwed: 900000,
        activeAffiliates: 2,
        commissionPerConversion: 300000,
        affiliates: [
          { affiliateId: "a1", name: "Alex", code: "ABCD1234", pendingTrials: 1, activeSubscriptions: 3, totalEarned: 900000, balance: 600000, hasBankInfo: true, lastPaidDate: "2026-05-03" },
          { affiliateId: "a2", name: "Sam", code: "EFG56789", pendingTrials: 0, activeSubscriptions: 1, totalEarned: 300000, balance: 300000, hasBankInfo: false, lastPaidDate: null },
        ],
      });

      const api = createNeonApi();
      const overview = await api.getAdminOverview();

      expect(overview.totalRevenue).toBe(1200000);
      expect(overview.totalPayoutOwed).toBe(900000);
      expect(overview.activeAffiliates).toBe(2);
      expect(overview.commissionPerConversion).toBe(300000);
      expect(overview.pendingTrials).toBe(1);      // sum of affiliate rows
      expect(overview.activeSubscriptions).toBe(4); // 3 + 1
      expect(overview.affiliates[0].totalRevenue).toBe(900000);  // totalEarned → totalRevenue
      expect(overview.affiliates[0].payoutOwed).toBe(600000);    // balance → payoutOwed
    });
  });

  describe("markPayoutPaid()", () => {
    it("POSTs to /api/admin/[id]/mark-paid", async () => {
      const mockUser = { uid: "u1", displayName: "Admin", email: "admin@t.com", getIdToken: vi.fn().mockResolvedValue("tok") };
      setCurrentUser(mockUser);
      mockFetch({ ok: true });

      const api = createNeonApi();
      await api.markPayoutPaid("aff-123");

      const fetchCall = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(fetchCall[0]).toContain("/admin/aff-123/mark-paid");
      expect(fetchCall[1].method).toBe("POST");
    });
  });

  describe("getCommissionSetting()", () => {
    it("returns commissionPerConversion from admin overview", async () => {
      const mockUser = { uid: "u1", displayName: "Admin", email: "admin@t.com", getIdToken: vi.fn().mockResolvedValue("tok") };
      setCurrentUser(mockUser);
      mockFetch({
        totalRevenue: 0, totalPayoutOwed: 0, activeAffiliates: 0,
        commissionPerConversion: 300000, affiliates: [],
      });

      const api = createNeonApi();
      const setting = await api.getCommissionSetting();
      expect(setting.commissionPerConversion).toBe(300000);
    });
  });
```

- [ ] **Step 2: Run all tests**

```bash
npm test -- --run src/api/__tests__/neonApi.test.ts
```

Expected: all tests pass

- [ ] **Step 3: Commit**

```bash
git add src/api/__tests__/neonApi.test.ts
git commit -m "test: add neonApi admin method tests"
```

---

## Task 5: Wire `neonApi` into `main.tsx` and delete `firebaseApi.ts`

**Files:**
- Modify: `src/main.tsx`
- Delete: `src/api/firebaseApi.ts`

- [ ] **Step 1: Update `src/main.tsx`**

Replace the file content:

```typescript
// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import { ApiContext } from "./api";
import { createNeonApi } from "./api/neonApi";
import { ThemeProvider } from "./lib/ThemeContext";
import "./index.css";

const api = createNeonApi();

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

- [ ] **Step 2: Delete `firebaseApi.ts`**

```bash
rm /Users/truongle/nutree-affiliate/src/api/firebaseApi.ts
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc -b --noEmit
```

Expected: no errors

- [ ] **Step 4: Run full test suite**

```bash
npm test -- --run
```

Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add src/main.tsx && git rm src/api/firebaseApi.ts
git commit -m "feat: wire neonApi into app, remove firebaseApi"
```

---

## Task 6: Smoke test and push

- [ ] **Step 1: Run full test suite one more time**

```bash
npm test -- --run
```

Expected: all pass

- [ ] **Step 2: Build the app**

```bash
npm run build
```

Expected: build succeeds, no TypeScript errors

- [ ] **Step 3: Deploy to Vercel**

```bash
npx vercel --prod --yes
```

Expected: deployment URL printed, status READY

- [ ] **Step 4: Manual smoke test — sign in flow**

Open `https://nutree-affiliate.vercel.app` in browser:
1. Click "Đăng nhập với Google"
2. Complete Google OAuth
3. Should land on PT dashboard showing stats (balance, referral code)
4. If any network error appears in browser console, check Vercel function logs

- [ ] **Step 5: Push to git**

```bash
git push origin main
```
