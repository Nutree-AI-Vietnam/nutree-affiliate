# Nutree Affiliate Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the frontend-only Nutree affiliate system — PT and admin dashboards backed by a typed mock `AffiliateApi` with fixtures, ready for a backend team to wire up later.

**Architecture:** Vite + React SPA. All data access goes through a single `AffiliateApi` interface; a `mockApi` implementation backed by fixtures is injected at app root, so swapping to a real backend is a one-line change. Routing is role-gated (`pt` vs `admin`) using a mock session in localStorage. QR codes are generated client-side.

**Tech Stack:** Vite, React 18, TypeScript, React Router v6, Tailwind CSS, qrcode, Vitest + React Testing Library.

---

## File Structure

```
package.json, vite.config.ts, tsconfig.json, tailwind.config.js, postcss.config.js, index.html
src/
  main.tsx                  App entry, router + ApiProvider
  App.tsx                   Route definitions + guards
  index.css                 Tailwind directives
  types/index.ts            All domain types
  api/
    index.ts                AffiliateApi interface + ApiContext/useApi
    fixtures.ts             Sample data
    mockApi.ts              Mock implementation of AffiliateApi
  auth/
    session.ts              localStorage session helpers
    guard.tsx               RequireRole route guard
  lib/
    format.ts               currency/date formatting helpers
  components/
    NavBar.tsx
    StatCard.tsx
    DataTable.tsx
    QrCode.tsx
    BankInfoForm.tsx
  pages/
    Login.tsx
    Register.tsx
    pt/Dashboard.tsx
    pt/Referral.tsx
    pt/BankInfo.tsx
    admin/Overview.tsx
src/**/__tests__/*.test.tsx
```

---

## Task 1: Project scaffold

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `tailwind.config.js`, `postcss.config.js`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/index.css`

- [ ] **Step 1: Scaffold Vite React-TS project**

Run:
```bash
npm create vite@latest . -- --template react-ts
npm install
npm install react-router-dom qrcode
npm install -D tailwindcss postcss autoprefixer @types/qrcode vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
npx tailwindcss init -p
```

- [ ] **Step 2: Configure Tailwind**

`tailwind.config.js`:
```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: [],
};
```

`src/index.css` (replace contents):
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 3: Configure Vitest**

Add to `vite.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: { environment: "jsdom", globals: true, setupFiles: "./src/test-setup.ts" },
});
```

Create `src/test-setup.ts`:
```ts
import "@testing-library/jest-dom";
```

Add scripts to `package.json`:
```json
"scripts": {
  "dev": "vite",
  "build": "tsc -b && vite build",
  "preview": "vite preview",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 4: Verify it builds and dev server starts**

Run: `npm run build`
Expected: build succeeds with no type errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite React-TS app with Tailwind and Vitest"
```

---

## Task 2: Domain types

**Files:**
- Create: `src/types/index.ts`

- [ ] **Step 1: Write the types**

`src/types/index.ts`:
```ts
export type Role = "pt" | "admin";

export interface Session {
  affiliateId: string;
  name: string;
  email: string;
  role: Role;
}

export interface MyStats {
  totalRevenue: number;
  totalPayout: number;
  pendingTrials: number;
  activeSubscriptions: number;
  lastPaymentDate: string | null;
}

export interface ReferralInfo {
  code: string;
  link: string;
}

export interface BankInfo {
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  routingOrSwift?: string;
}

export interface Payout {
  period: string;
  conversions: number;
  amount: number;
  status: "pending" | "paid";
  paidDate: string | null;
}

export interface AffiliateRow {
  affiliateId: string;
  name: string;
  code: string;
  pendingTrials: number;
  activeSubscriptions: number;
  totalRevenue: number;
  payoutOwed: number;
  hasBankInfo: boolean;
  lastPaidDate: string | null;
}

export interface AdminOverview {
  totalRevenue: number;
  totalPayoutOwed: number;
  activeAffiliates: number;
  pendingTrials: number;
  activeSubscriptions: number;
  commissionPerConversion: number;
  affiliates: AffiliateRow[];
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: PASS (no errors).

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add affiliate domain types"
```

---

## Task 3: AffiliateApi interface + context

**Files:**
- Create: `src/api/index.ts`

- [ ] **Step 1: Write the interface and React context**

`src/api/index.ts`:
```ts
import { createContext, useContext } from "react";
import type {
  Session, MyStats, ReferralInfo, BankInfo, Payout, AdminOverview,
} from "../types";

export interface AffiliateApi {
  login(email: string, password: string): Promise<Session>;
  register(input: { email: string; password: string; name: string }): Promise<Session>;
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

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/api/index.ts
git commit -m "feat: add AffiliateApi interface and React context"
```

---

## Task 4: Fixtures

**Files:**
- Create: `src/api/fixtures.ts`

- [ ] **Step 1: Write fixtures**

`src/api/fixtures.ts`:
```ts
import type { Session, BankInfo, Payout, AffiliateRow } from "../types";

export const COMMISSION_PER_CONVERSION = 10;

export interface FixtureAffiliate {
  session: Session;
  password: string;
  bankInfo: BankInfo | null;
  pendingTrials: number;
  activeSubscriptions: number;
  totalRevenue: number;
  lastPaidDate: string | null;
  payouts: Payout[];
}

export const affiliates: FixtureAffiliate[] = [
  {
    session: { affiliateId: "a1", name: "Alex R.", email: "alex@pt.com", role: "pt" },
    password: "password",
    bankInfo: { bankName: "Chase", accountHolder: "Alex Reed", accountNumber: "000123456", routingOrSwift: "021000021" },
    pendingTrials: 12,
    activeSubscriptions: 64,
    totalRevenue: 4820,
    lastPaidDate: "2026-05-28",
    payouts: [
      { period: "2026-05", conversions: 8, amount: 80, status: "paid", paidDate: "2026-05-28" },
      { period: "2026-06", conversions: 3, amount: 30, status: "pending", paidDate: null },
    ],
  },
  {
    session: { affiliateId: "a2", name: "Sam T.", email: "sam@pt.com", role: "pt" },
    password: "password",
    bankInfo: null,
    pendingTrials: 5,
    activeSubscriptions: 31,
    totalRevenue: 2310,
    lastPaidDate: null,
    payouts: [{ period: "2026-06", conversions: 2, amount: 20, status: "pending", paidDate: null }],
  },
  {
    session: { affiliateId: "a3", name: "Jo K.", email: "jo@pt.com", role: "pt" },
    password: "password",
    bankInfo: { bankName: "Wells Fargo", accountHolder: "Jo King", accountNumber: "000987654" },
    pendingTrials: 9,
    activeSubscriptions: 52,
    totalRevenue: 3900,
    lastPaidDate: "2026-05-28",
    payouts: [{ period: "2026-05", conversions: 6, amount: 60, status: "paid", paidDate: "2026-05-28" }],
  },
];

export const adminSession: Session = {
  affiliateId: "admin1", name: "Nutree Admin", email: "admin@nutree.app", role: "admin",
};
export const adminPassword = "admin";

export function toAffiliateRow(a: FixtureAffiliate): AffiliateRow {
  return {
    affiliateId: a.session.affiliateId,
    name: a.session.name,
    code: codeFromEmail(a.session.email),
    pendingTrials: a.pendingTrials,
    activeSubscriptions: a.activeSubscriptions,
    totalRevenue: a.totalRevenue,
    payoutOwed: a.activeSubscriptions * COMMISSION_PER_CONVERSION,
    hasBankInfo: a.bankInfo !== null,
    lastPaidDate: a.lastPaidDate,
  };
}

export function codeFromEmail(email: string): string {
  const local = email.split("@")[0].toUpperCase().replace(/[^A-Z0-9]/g, "");
  return `${local}-NUTREE`;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/api/fixtures.ts
git commit -m "feat: add affiliate fixtures and helpers"
```

---

## Task 5: Mock API implementation (TDD)

**Files:**
- Create: `src/api/mockApi.ts`
- Test: `src/api/__tests__/mockApi.test.ts`

- [ ] **Step 1: Write the failing test**

`src/api/__tests__/mockApi.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { createMockApi } from "../mockApi";
import { COMMISSION_PER_CONVERSION } from "../fixtures";

describe("mockApi", () => {
  it("logs in a PT with valid credentials", async () => {
    const api = createMockApi();
    const session = await api.login("alex@pt.com", "password");
    expect(session.role).toBe("pt");
    expect(session.affiliateId).toBe("a1");
  });

  it("rejects invalid credentials", async () => {
    const api = createMockApi();
    await expect(api.login("alex@pt.com", "wrong")).rejects.toThrow();
  });

  it("computes totalPayout as activeSubscriptions * commission", async () => {
    const api = createMockApi();
    await api.login("alex@pt.com", "password");
    const stats = await api.getMyStats();
    expect(stats.totalPayout).toBe(64 * COMMISSION_PER_CONVERSION);
    expect(stats.activeSubscriptions).toBe(64);
  });

  it("returns admin overview with aggregated totals", async () => {
    const api = createMockApi();
    await api.login("admin@nutree.app", "admin");
    const overview = await api.getAdminOverview();
    expect(overview.affiliates.length).toBe(3);
    expect(overview.totalRevenue).toBe(4820 + 2310 + 3900);
    expect(overview.commissionPerConversion).toBe(COMMISSION_PER_CONVERSION);
  });

  it("saves and returns bank info for current PT", async () => {
    const api = createMockApi();
    await api.login("sam@pt.com", "password");
    expect(await api.getMyBankInfo()).toBeNull();
    const info = { bankName: "B", accountHolder: "H", accountNumber: "1" };
    await api.saveBankInfo(info);
    expect(await api.getMyBankInfo()).toEqual(info);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/api/__tests__/mockApi.test.ts`
Expected: FAIL ("createMockApi is not a function" / module not found).

- [ ] **Step 3: Write minimal implementation**

`src/api/mockApi.ts`:
```ts
import type { AffiliateApi } from "./index";
import type { Session, MyStats, ReferralInfo, BankInfo, Payout, AdminOverview } from "../types";
import {
  affiliates, adminSession, adminPassword, COMMISSION_PER_CONVERSION,
  toAffiliateRow, codeFromEmail, type FixtureAffiliate,
} from "./fixtures";

const delay = () => new Promise((r) => setTimeout(r, 150));

export function createMockApi(): AffiliateApi {
  const data: FixtureAffiliate[] = affiliates.map((a) => ({ ...a, bankInfo: a.bankInfo }));
  let current: Session | null = null;

  const me = (): FixtureAffiliate => {
    const found = data.find((a) => a.session.affiliateId === current?.affiliateId);
    if (!found) throw new Error("Not authenticated as a PT");
    return found;
  };

  return {
    async login(email, password) {
      await delay();
      if (email === adminSession.email && password === adminPassword) {
        current = adminSession; return adminSession;
      }
      const a = data.find((x) => x.session.email === email);
      if (!a || a.password !== password) throw new Error("Invalid email or password");
      current = a.session; return a.session;
    },
    async register({ email, password, name }) {
      await delay();
      if (data.some((x) => x.session.email === email)) throw new Error("Email already registered");
      const session: Session = { affiliateId: `a${data.length + 1}`, name, email, role: "pt" };
      data.push({
        session, password, bankInfo: null, pendingTrials: 0,
        activeSubscriptions: 0, totalRevenue: 0, lastPaidDate: null, payouts: [],
      });
      current = session; return session;
    },
    async logout() { await delay(); current = null; },

    async getMyStats(): Promise<MyStats> {
      await delay();
      const a = me();
      return {
        totalRevenue: a.totalRevenue,
        totalPayout: a.activeSubscriptions * COMMISSION_PER_CONVERSION,
        pendingTrials: a.pendingTrials,
        activeSubscriptions: a.activeSubscriptions,
        lastPaymentDate: a.lastPaidDate,
      };
    },
    async getMyReferral(): Promise<ReferralInfo> {
      await delay();
      const code = codeFromEmail(me().session.email);
      return { code, link: `https://nutree.app/r/${code}` };
    },
    async getMyBankInfo(): Promise<BankInfo | null> { await delay(); return me().bankInfo; },
    async saveBankInfo(info): Promise<BankInfo> { await delay(); me().bankInfo = info; return info; },
    async getMyPayouts(): Promise<Payout[]> { await delay(); return me().payouts; },

    async getAdminOverview(): Promise<AdminOverview> {
      await delay();
      const rows = data.map(toAffiliateRow);
      return {
        totalRevenue: rows.reduce((s, r) => s + r.totalRevenue, 0),
        totalPayoutOwed: rows.reduce((s, r) => s + r.payoutOwed, 0),
        activeAffiliates: rows.length,
        pendingTrials: rows.reduce((s, r) => s + r.pendingTrials, 0),
        activeSubscriptions: rows.reduce((s, r) => s + r.activeSubscriptions, 0),
        commissionPerConversion: COMMISSION_PER_CONVERSION,
        affiliates: rows,
      };
    },
    async markPayoutPaid(affiliateId, _note) {
      await delay();
      const a = data.find((x) => x.session.affiliateId === affiliateId);
      if (!a) throw new Error("Affiliate not found");
      a.lastPaidDate = new Date().toISOString().slice(0, 10);
      a.payouts = a.payouts.map((p) =>
        p.status === "pending" ? { ...p, status: "paid", paidDate: a.lastPaidDate } : p);
    },
    async getCommissionSetting() { await delay(); return { commissionPerConversion: COMMISSION_PER_CONVERSION }; },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/api/__tests__/mockApi.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/api/mockApi.ts src/api/__tests__/mockApi.test.ts
git commit -m "feat: add mock AffiliateApi implementation with tests"
```

---

## Task 6: Session helpers (TDD)

**Files:**
- Create: `src/auth/session.ts`
- Test: `src/auth/__tests__/session.test.ts`

- [ ] **Step 1: Write the failing test**

`src/auth/__tests__/session.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { saveSession, loadSession, clearSession } from "../session";

describe("session storage", () => {
  beforeEach(() => localStorage.clear());

  it("returns null when no session stored", () => {
    expect(loadSession()).toBeNull();
  });

  it("saves and loads a session", () => {
    const s = { affiliateId: "a1", name: "A", email: "a@x.com", role: "pt" as const };
    saveSession(s);
    expect(loadSession()).toEqual(s);
  });

  it("clears the session", () => {
    saveSession({ affiliateId: "a1", name: "A", email: "a@x.com", role: "pt" });
    clearSession();
    expect(loadSession()).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/auth/__tests__/session.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write minimal implementation**

`src/auth/session.ts`:
```ts
import type { Session } from "../types";

const KEY = "nutree.session";

export function saveSession(session: Session): void {
  localStorage.setItem(KEY, JSON.stringify(session));
}

export function loadSession(): Session | null {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as Session; } catch { return null; }
}

export function clearSession(): void {
  localStorage.removeItem(KEY);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/auth/__tests__/session.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/auth/session.ts src/auth/__tests__/session.test.ts
git commit -m "feat: add localStorage session helpers with tests"
```

---

## Task 7: Format helpers (TDD)

**Files:**
- Create: `src/lib/format.ts`
- Test: `src/lib/__tests__/format.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/__tests__/format.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { currency, dateOrDash } from "../format";

describe("format helpers", () => {
  it("formats currency in USD", () => {
    expect(currency(4820)).toBe("$4,820");
  });
  it("renders dash for null dates", () => {
    expect(dateOrDash(null)).toBe("—");
  });
  it("passes through a date string", () => {
    expect(dateOrDash("2026-05-28")).toBe("2026-05-28");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/__tests__/format.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write minimal implementation**

`src/lib/format.ts`:
```ts
export function currency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: 0,
  }).format(amount);
}

export function dateOrDash(date: string | null): string {
  return date ?? "—";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/__tests__/format.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/format.ts src/lib/__tests__/format.test.ts
git commit -m "feat: add currency and date format helpers with tests"
```

---

## Task 8: Route guard (TDD)

**Files:**
- Create: `src/auth/guard.tsx`
- Test: `src/auth/__tests__/guard.test.tsx`

- [ ] **Step 1: Write the failing test**

`src/auth/__tests__/guard.test.tsx`:
```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { RequireRole } from "../guard";
import { saveSession, clearSession } from "../session";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<div>login page</div>} />
        <Route element={<RequireRole role="admin" />}>
          <Route path="/admin" element={<div>admin area</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe("RequireRole", () => {
  beforeEach(() => clearSession());

  it("redirects to login when no session", () => {
    renderAt("/admin");
    expect(screen.getByText("login page")).toBeInTheDocument();
  });

  it("redirects when role does not match", () => {
    saveSession({ affiliateId: "a1", name: "A", email: "a@x.com", role: "pt" });
    renderAt("/admin");
    expect(screen.getByText("login page")).toBeInTheDocument();
  });

  it("renders the child route when role matches", () => {
    saveSession({ affiliateId: "admin1", name: "Admin", email: "a@n.com", role: "admin" });
    renderAt("/admin");
    expect(screen.getByText("admin area")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/auth/__tests__/guard.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Write minimal implementation**

`src/auth/guard.tsx`:
```tsx
import { Navigate, Outlet } from "react-router-dom";
import type { Role } from "../types";
import { loadSession } from "./session";

export function RequireRole({ role }: { role: Role }) {
  const session = loadSession();
  if (!session) return <Navigate to="/login" replace />;
  if (session.role !== role) return <Navigate to="/login" replace />;
  return <Outlet />;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/auth/__tests__/guard.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/auth/guard.tsx src/auth/__tests__/guard.test.tsx
git commit -m "feat: add role-based route guard with tests"
```

---

## Task 9: Presentational components (TDD)

**Files:**
- Create: `src/components/StatCard.tsx`, `src/components/DataTable.tsx`, `src/components/QrCode.tsx`, `src/components/NavBar.tsx`, `src/components/BankInfoForm.tsx`
- Test: `src/components/__tests__/StatCard.test.tsx`, `src/components/__tests__/DataTable.test.tsx`, `src/components/__tests__/BankInfoForm.test.tsx`

- [ ] **Step 1: Write failing tests**

`src/components/__tests__/StatCard.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatCard } from "../StatCard";

describe("StatCard", () => {
  it("renders label and value", () => {
    render(<StatCard label="Total Revenue" value="$4,820" />);
    expect(screen.getByText("Total Revenue")).toBeInTheDocument();
    expect(screen.getByText("$4,820")).toBeInTheDocument();
  });
});
```

`src/components/__tests__/DataTable.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DataTable } from "../DataTable";

describe("DataTable", () => {
  const cols = [
    { key: "name", header: "Name" },
    { key: "amt", header: "Amount", render: (r: any) => `$${r.amt}` },
  ];
  it("renders headers and rows", () => {
    render(<DataTable columns={cols} rows={[{ name: "Alex", amt: 80 }]} rowKey={(r) => r.name} />);
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Alex")).toBeInTheDocument();
    expect(screen.getByText("$80")).toBeInTheDocument();
  });
  it("renders an empty state", () => {
    render(<DataTable columns={cols} rows={[]} rowKey={(r) => r.name} empty="Nothing here" />);
    expect(screen.getByText("Nothing here")).toBeInTheDocument();
  });
});
```

`src/components/__tests__/BankInfoForm.test.tsx`:
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BankInfoForm } from "../BankInfoForm";

describe("BankInfoForm", () => {
  it("submits entered values", async () => {
    const onSave = vi.fn();
    render(<BankInfoForm initial={null} onSave={onSave} />);
    await userEvent.type(screen.getByLabelText("Bank name"), "Chase");
    await userEvent.type(screen.getByLabelText("Account holder"), "Alex Reed");
    await userEvent.type(screen.getByLabelText("Account number / IBAN"), "000123456");
    await userEvent.click(screen.getByRole("button", { name: /save/i }));
    expect(onSave).toHaveBeenCalledWith({
      bankName: "Chase", accountHolder: "Alex Reed",
      accountNumber: "000123456", routingOrSwift: "",
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/components`
Expected: FAIL (modules not found).

- [ ] **Step 3: Write implementations**

`src/components/StatCard.tsx`:
```tsx
export function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}
```

`src/components/DataTable.tsx`:
```tsx
import type { ReactNode } from "react";

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
}

export function DataTable<T>({
  columns, rows, rowKey, empty = "No data",
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  empty?: string;
}) {
  if (rows.length === 0) {
    return <div className="p-6 text-center text-sm text-gray-500">{empty}</div>;
  }
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="text-left text-gray-500">
          {columns.map((c) => <th key={c.key} className="py-2 pr-4 font-medium">{c.header}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={rowKey(row)} className="border-t border-gray-100">
            {columns.map((c) => (
              <td key={c.key} className="py-2 pr-4">
                {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key])}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

`src/components/QrCode.tsx`:
```tsx
import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function QrCode({ value, size = 160 }: { value: string; size?: number }) {
  const [dataUrl, setDataUrl] = useState<string>("");
  useEffect(() => {
    QRCode.toDataURL(value, { width: size, margin: 1 }).then(setDataUrl).catch(() => setDataUrl(""));
  }, [value, size]);
  if (!dataUrl) return <div style={{ width: size, height: size }} className="bg-gray-100" />;
  return <img src={dataUrl} width={size} height={size} alt={`QR code for ${value}`} />;
}
```

`src/components/NavBar.tsx`:
```tsx
import { Link, useNavigate } from "react-router-dom";
import { clearSession } from "../auth/session";

export function NavBar({ links, title }: { links: { to: string; label: string }[]; title: string }) {
  const navigate = useNavigate();
  return (
    <nav className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
      <strong>{title}</strong>
      <div className="flex gap-4 text-sm">
        {links.map((l) => <Link key={l.to} to={l.to} className="hover:underline">{l.label}</Link>)}
        <button
          onClick={() => { clearSession(); navigate("/login"); }}
          className="hover:underline">Logout</button>
      </div>
    </nav>
  );
}
```

`src/components/BankInfoForm.tsx`:
```tsx
import { useState } from "react";
import type { BankInfo } from "../types";

export function BankInfoForm({
  initial, onSave,
}: { initial: BankInfo | null; onSave: (info: BankInfo) => void }) {
  const [bankName, setBankName] = useState(initial?.bankName ?? "");
  const [accountHolder, setAccountHolder] = useState(initial?.accountHolder ?? "");
  const [accountNumber, setAccountNumber] = useState(initial?.accountNumber ?? "");
  const [routingOrSwift, setRoutingOrSwift] = useState(initial?.routingOrSwift ?? "");

  const field = "mt-1 w-full rounded border border-gray-300 px-3 py-2";
  return (
    <form
      className="max-w-md space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ bankName, accountHolder, accountNumber, routingOrSwift });
      }}
    >
      <label className="block text-sm">Bank name
        <input className={field} value={bankName} onChange={(e) => setBankName(e.target.value)} required />
      </label>
      <label className="block text-sm">Account holder
        <input className={field} value={accountHolder} onChange={(e) => setAccountHolder(e.target.value)} required />
      </label>
      <label className="block text-sm">Account number / IBAN
        <input className={field} value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} required />
      </label>
      <label className="block text-sm">Routing / SWIFT (optional)
        <input className={field} value={routingOrSwift} onChange={(e) => setRoutingOrSwift(e.target.value)} />
      </label>
      <button type="submit" className="rounded bg-black px-4 py-2 text-white">Save</button>
    </form>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/components`
Expected: PASS (StatCard, DataTable x2, BankInfoForm).

- [ ] **Step 5: Commit**

```bash
git add src/components
git commit -m "feat: add presentational components with tests"
```

---

## Task 10: Auth pages (Login / Register)

**Files:**
- Create: `src/pages/Login.tsx`, `src/pages/Register.tsx`
- Test: `src/pages/__tests__/Login.test.tsx`

- [ ] **Step 1: Write the failing test**

`src/pages/__tests__/Login.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { ApiContext } from "../../api";
import { createMockApi } from "../../api/mockApi";
import { Login } from "../Login";

function setup() {
  return render(
    <ApiContext.Provider value={createMockApi()}>
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
  it("logs in a PT and navigates to the PT dashboard", async () => {
    setup();
    await userEvent.type(screen.getByLabelText(/email/i), "alex@pt.com");
    await userEvent.type(screen.getByLabelText(/password/i), "password");
    await userEvent.click(screen.getByRole("button", { name: /log in/i }));
    await waitFor(() => expect(screen.getByText("pt dashboard")).toBeInTheDocument());
  });

  it("shows an error on bad credentials", async () => {
    setup();
    await userEvent.type(screen.getByLabelText(/email/i), "alex@pt.com");
    await userEvent.type(screen.getByLabelText(/password/i), "nope");
    await userEvent.click(screen.getByRole("button", { name: /log in/i }));
    await waitFor(() => expect(screen.getByText(/invalid/i)).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/pages/__tests__/Login.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Write implementations**

`src/pages/Login.tsx`:
```tsx
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useApi } from "../api";
import { saveSession } from "../auth/session";

export function Login() {
  const api = useApi();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const session = await api.login(email, password);
      saveSession(session);
      navigate(session.role === "admin" ? "/admin" : "/pt");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  const field = "mt-1 w-full rounded border border-gray-300 px-3 py-2";
  return (
    <div className="mx-auto mt-24 max-w-sm">
      <h1 className="mb-6 text-2xl font-bold">Nutree Affiliates</h1>
      <form className="space-y-3" onSubmit={submit}>
        <label className="block text-sm">Email
          <input className={field} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="block text-sm">Password
          <input className={field} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button disabled={loading} className="w-full rounded bg-black px-4 py-2 text-white disabled:opacity-50">
          {loading ? "Logging in…" : "Log in"}
        </button>
      </form>
      <p className="mt-4 text-sm">No account? <Link className="underline" to="/register">Register</Link></p>
    </div>
  );
}
```

`src/pages/Register.tsx`:
```tsx
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useApi } from "../api";
import { saveSession } from "../auth/session";

export function Register() {
  const api = useApi();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const session = await api.register({ name, email, password });
      saveSession(session);
      navigate("/pt");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  const field = "mt-1 w-full rounded border border-gray-300 px-3 py-2";
  return (
    <div className="mx-auto mt-24 max-w-sm">
      <h1 className="mb-6 text-2xl font-bold">Create your affiliate account</h1>
      <form className="space-y-3" onSubmit={submit}>
        <label className="block text-sm">Name
          <input className={field} value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label className="block text-sm">Email
          <input className={field} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="block text-sm">Password
          <input className={field} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button disabled={loading} className="w-full rounded bg-black px-4 py-2 text-white disabled:opacity-50">
          {loading ? "Creating…" : "Create account"}
        </button>
      </form>
      <p className="mt-4 text-sm">Have an account? <Link className="underline" to="/login">Log in</Link></p>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/pages/__tests__/Login.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Login.tsx src/pages/Register.tsx src/pages/__tests__/Login.test.tsx
git commit -m "feat: add login and register pages with tests"
```

---

## Task 11: PT pages (Dashboard / Referral / BankInfo)

**Files:**
- Create: `src/pages/pt/Dashboard.tsx`, `src/pages/pt/Referral.tsx`, `src/pages/pt/BankInfo.tsx`
- Test: `src/pages/pt/__tests__/Dashboard.test.tsx`

- [ ] **Step 1: Write the failing test**

`src/pages/pt/__tests__/Dashboard.test.tsx`:
```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ApiContext } from "../../../api";
import { createMockApi } from "../../../api/mockApi";
import { saveSession } from "../../../auth/session";
import { Dashboard } from "../Dashboard";

describe("PT Dashboard", () => {
  beforeEach(() => localStorage.clear());

  it("shows the PT stats after loading", async () => {
    const api = createMockApi();
    await api.login("alex@pt.com", "password");
    saveSession({ affiliateId: "a1", name: "Alex R.", email: "alex@pt.com", role: "pt" });
    render(
      <ApiContext.Provider value={api}>
        <MemoryRouter><Dashboard /></MemoryRouter>
      </ApiContext.Provider>
    );
    await waitFor(() => expect(screen.getByText("$4,820")).toBeInTheDocument());
    expect(screen.getByText("Total Revenue")).toBeInTheDocument();
    expect(screen.getByText("64")).toBeInTheDocument(); // active subs
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/pages/pt/__tests__/Dashboard.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Write implementations**

`src/pages/pt/Dashboard.tsx`:
```tsx
import { useEffect, useState } from "react";
import { useApi } from "../../api";
import { NavBar } from "../../components/NavBar";
import { StatCard } from "../../components/StatCard";
import { DataTable } from "../../components/DataTable";
import { QrCode } from "../../components/QrCode";
import { currency, dateOrDash } from "../../lib/format";
import type { MyStats, ReferralInfo, Payout } from "../../types";

const ptLinks = [
  { to: "/pt", label: "Dashboard" },
  { to: "/pt/referral", label: "My Code" },
  { to: "/pt/bank", label: "Bank Info" },
];

export function Dashboard() {
  const api = useApi();
  const [stats, setStats] = useState<MyStats | null>(null);
  const [referral, setReferral] = useState<ReferralInfo | null>(null);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api.getMyStats(), api.getMyReferral(), api.getMyPayouts()])
      .then(([s, r, p]) => { setStats(s); setReferral(r); setPayouts(p); })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, [api]);

  return (
    <div>
      <NavBar title="Nutree Affiliates" links={ptLinks} />
      <main className="mx-auto max-w-5xl p-6">
        {error && <p className="text-red-600">{error}</p>}
        {!stats ? <p className="text-gray-500">Loading…</p> : (
          <>
            <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
              <StatCard label="Total Revenue" value={currency(stats.totalRevenue)} />
              <StatCard label="Total Payout" value={currency(stats.totalPayout)} />
              <StatCard label="Pending Trials" value={String(stats.pendingTrials)} />
              <StatCard label="Active Subs" value={String(stats.activeSubscriptions)} />
              <StatCard label="Last Payment" value={dateOrDash(stats.lastPaymentDate)} />
            </div>
            {referral && (
              <div className="mb-6 flex items-center gap-5 rounded-xl border border-gray-200 bg-white p-4">
                <QrCode value={referral.link} size={90} />
                <div>
                  <div className="text-xs uppercase text-gray-500">Your referral code</div>
                  <div className="text-lg font-bold">{referral.code}</div>
                  <div className="mt-1 font-mono text-sm">{referral.link}</div>
                </div>
              </div>
            )}
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="mb-2 text-xs uppercase text-gray-500">Payout history</div>
              <DataTable
                rows={payouts}
                rowKey={(p) => p.period}
                empty="Share your link to start earning"
                columns={[
                  { key: "period", header: "Period" },
                  { key: "conversions", header: "Conversions" },
                  { key: "amount", header: "Amount", render: (p) => currency(p.amount) },
                  { key: "status", header: "Status", render: (p) => (p.status === "paid" ? "Paid" : "Pending") },
                  { key: "paidDate", header: "Paid date", render: (p) => dateOrDash(p.paidDate) },
                ]}
              />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
```

`src/pages/pt/Referral.tsx`:
```tsx
import { useEffect, useState } from "react";
import { useApi } from "../../api";
import { NavBar } from "../../components/NavBar";
import { QrCode } from "../../components/QrCode";
import type { ReferralInfo } from "../../types";

const ptLinks = [
  { to: "/pt", label: "Dashboard" },
  { to: "/pt/referral", label: "My Code" },
  { to: "/pt/bank", label: "Bank Info" },
];

export function Referral() {
  const api = useApi();
  const [referral, setReferral] = useState<ReferralInfo | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => { api.getMyReferral().then(setReferral); }, [api]);

  return (
    <div>
      <NavBar title="Nutree Affiliates" links={ptLinks} />
      <main className="mx-auto max-w-2xl p-6">
        <h1 className="mb-4 text-xl font-bold">Your referral</h1>
        {!referral ? <p className="text-gray-500">Loading…</p> : (
          <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-6">
            <QrCode value={referral.link} size={200} />
            <div>
              <div className="text-xs uppercase text-gray-500">Referral code</div>
              <div className="text-2xl font-bold">{referral.code}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-gray-500">Shareable link</div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm">{referral.link}</span>
                <button
                  className="rounded bg-black px-3 py-1 text-sm text-white"
                  onClick={async () => {
                    await navigator.clipboard.writeText(referral.link);
                    setCopied(true);
                  }}>
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
```

`src/pages/pt/BankInfo.tsx`:
```tsx
import { useEffect, useState } from "react";
import { useApi } from "../../api";
import { NavBar } from "../../components/NavBar";
import { BankInfoForm } from "../../components/BankInfoForm";
import type { BankInfo as BankInfoType } from "../../types";

const ptLinks = [
  { to: "/pt", label: "Dashboard" },
  { to: "/pt/referral", label: "My Code" },
  { to: "/pt/bank", label: "Bank Info" },
];

export function BankInfo() {
  const api = useApi();
  const [info, setInfo] = useState<BankInfoType | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.getMyBankInfo().then((i) => { setInfo(i); setLoaded(true); });
  }, [api]);

  return (
    <div>
      <NavBar title="Nutree Affiliates" links={ptLinks} />
      <main className="mx-auto max-w-2xl p-6">
        <h1 className="mb-4 text-xl font-bold">Bank information</h1>
        {!loaded ? <p className="text-gray-500">Loading…</p> : (
          <>
            {saved && <p className="mb-3 text-sm text-green-700">Saved.</p>}
            <BankInfoForm
              initial={info}
              onSave={async (next) => {
                const result = await api.saveBankInfo(next);
                setInfo(result); setSaved(true);
              }}
            />
          </>
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/pages/pt/__tests__/Dashboard.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/pt
git commit -m "feat: add PT dashboard, referral, and bank info pages with test"
```

---

## Task 12: Admin overview page

**Files:**
- Create: `src/pages/admin/Overview.tsx`
- Test: `src/pages/admin/__tests__/Overview.test.tsx`

- [ ] **Step 1: Write the failing test**

`src/pages/admin/__tests__/Overview.test.tsx`:
```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ApiContext } from "../../../api";
import { createMockApi } from "../../../api/mockApi";
import { saveSession } from "../../../auth/session";
import { Overview } from "../Overview";

describe("Admin Overview", () => {
  beforeEach(() => localStorage.clear());

  it("shows total revenue and the affiliate table", async () => {
    const api = createMockApi();
    saveSession({ affiliateId: "admin1", name: "Admin", email: "admin@nutree.app", role: "admin" });
    render(
      <ApiContext.Provider value={api}>
        <MemoryRouter><Overview /></MemoryRouter>
      </ApiContext.Provider>
    );
    await waitFor(() => expect(screen.getByText("$11,030")).toBeInTheDocument()); // 4820+2310+3900
    expect(screen.getByText("Alex R.")).toBeInTheDocument();
    expect(screen.getByText("Sam T.")).toBeInTheDocument();
  });

  it("filters affiliates by search", async () => {
    const api = createMockApi();
    saveSession({ affiliateId: "admin1", name: "Admin", email: "admin@nutree.app", role: "admin" });
    render(
      <ApiContext.Provider value={api}>
        <MemoryRouter><Overview /></MemoryRouter>
      </ApiContext.Provider>
    );
    await waitFor(() => expect(screen.getByText("Alex R.")).toBeInTheDocument());
    await userEvent.type(screen.getByPlaceholderText(/search/i), "Sam");
    expect(screen.queryByText("Alex R.")).not.toBeInTheDocument();
    expect(screen.getByText("Sam T.")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/pages/admin/__tests__/Overview.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Write implementation**

`src/pages/admin/Overview.tsx`:
```tsx
import { useEffect, useMemo, useState } from "react";
import { useApi } from "../../api";
import { NavBar } from "../../components/NavBar";
import { StatCard } from "../../components/StatCard";
import { DataTable } from "../../components/DataTable";
import { currency, dateOrDash } from "../../lib/format";
import type { AdminOverview } from "../../types";

const adminLinks = [{ to: "/admin", label: "Overview" }];

export function Overview() {
  const api = useApi();
  const [data, setData] = useState<AdminOverview | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  const load = () =>
    api.getAdminOverview().then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));

  useEffect(() => { load(); }, [api]);

  const rows = useMemo(() => {
    if (!data) return [];
    const q = query.toLowerCase();
    return data.affiliates.filter(
      (a) => a.name.toLowerCase().includes(q) || a.code.toLowerCase().includes(q));
  }, [data, query]);

  return (
    <div>
      <NavBar title="Nutree Affiliates — Admin" links={adminLinks} />
      <main className="mx-auto max-w-6xl p-6">
        {error && <p className="text-red-600">{error}</p>}
        {!data ? <p className="text-gray-500">Loading…</p> : (
          <>
            <div className="mb-4 rounded-xl bg-black p-5 text-white">
              <div className="text-xs uppercase text-gray-300">Total Revenue (all affiliates)</div>
              <div className="text-3xl font-extrabold">{currency(data.totalRevenue)}</div>
              <div className="mt-1 text-sm text-gray-300">
                Total payout owed: {currency(data.totalPayoutOwed)} · {data.activeAffiliates} active affiliates
              </div>
            </div>
            <div className="mb-4 grid grid-cols-3 gap-3">
              <StatCard label="Pending Trials" value={String(data.pendingTrials)} />
              <StatCard label="Active Subscriptions" value={String(data.activeSubscriptions)} />
              <StatCard label="Commission / conversion" value={currency(data.commissionPerConversion)} />
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-xs uppercase text-gray-500">Affiliates</div>
                <input
                  className="w-56 rounded border border-gray-300 px-2 py-1 text-sm"
                  placeholder="Search affiliate…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <DataTable
                rows={rows}
                rowKey={(r) => r.affiliateId}
                empty="No affiliates"
                columns={[
                  { key: "name", header: "Name" },
                  { key: "code", header: "Code" },
                  { key: "pendingTrials", header: "Pending" },
                  { key: "activeSubscriptions", header: "Active" },
                  { key: "totalRevenue", header: "Revenue", render: (r) => currency(r.totalRevenue) },
                  { key: "payoutOwed", header: "Payout owed", render: (r) => currency(r.payoutOwed) },
                  { key: "hasBankInfo", header: "Bank info", render: (r) => (r.hasBankInfo ? "OK" : "Missing") },
                  { key: "lastPaidDate", header: "Last paid", render: (r) => dateOrDash(r.lastPaidDate) },
                  {
                    key: "action", header: "",
                    render: (r) => (
                      <button
                        className="rounded bg-black px-2 py-1 text-xs text-white"
                        onClick={async () => { await api.markPayoutPaid(r.affiliateId); await load(); }}>
                        Mark paid
                      </button>
                    ),
                  },
                ]}
              />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/pages/admin/__tests__/Overview.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/admin
git commit -m "feat: add admin overview page with search and mark-paid"
```

---

## Task 13: Wire up app root, router, and provider

**Files:**
- Modify: `src/main.tsx`, `src/App.tsx`

- [ ] **Step 1: Write App with routes**

`src/App.tsx`:
```tsx
import { Routes, Route, Navigate } from "react-router-dom";
import { RequireRole } from "./auth/guard";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { Dashboard } from "./pages/pt/Dashboard";
import { Referral } from "./pages/pt/Referral";
import { BankInfo } from "./pages/pt/BankInfo";
import { Overview } from "./pages/admin/Overview";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route element={<RequireRole role="pt" />}>
        <Route path="/pt" element={<Dashboard />} />
        <Route path="/pt/referral" element={<Referral />} />
        <Route path="/pt/bank" element={<BankInfo />} />
      </Route>
      <Route element={<RequireRole role="admin" />}>
        <Route path="/admin" element={<Overview />} />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
```

`src/main.tsx`:
```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import { ApiContext } from "./api";
import { createMockApi } from "./api/mockApi";
import "./index.css";

const api = createMockApi();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ApiContext.Provider value={api}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ApiContext.Provider>
  </React.StrictMode>
);
```

- [ ] **Step 2: Run full test suite and build**

Run: `npm test && npm run build`
Expected: all tests PASS, build succeeds.

- [ ] **Step 3: Manual smoke test**

Run: `npm run dev`, then in the browser:
- `/login` → log in `alex@pt.com` / `password` → lands on PT dashboard showing `$4,820`.
- Visit My Code → QR + copy link work.
- Visit Bank Info → save form → "Saved." appears.
- Log out, log in `admin@nutree.app` / `admin` → admin overview shows total revenue, table, search filters, "Mark paid" updates the row's last-paid date.

- [ ] **Step 4: Commit**

```bash
git add src/main.tsx src/App.tsx
git commit -m "feat: wire up router, route guards, and mock API provider"
```

---

## Self-Review Notes

- **Spec coverage:** stack (T1), types/contract (T2–T3), fixtures + commission math (T4–T5), auth pages + mock auth (T5, T10), session + guard (T6, T8), PT dashboard/referral/bank (T11), admin overview + mark-paid + search (T12), QR client-side (T9), error/empty/loading states (pages + DataTable empty), testing (every task). Handoff (§10) satisfied because all access is via `AffiliateApi`, swappable in `main.tsx`.
- **Type consistency:** `createMockApi`, `AffiliateApi`, `MyStats.totalPayout`, `AffiliateRow.payoutOwed`, `markPayoutPaid(affiliateId)`, `codeFromEmail` used consistently across tasks.
- **Admin total check:** fixtures revenue 4820+2310+3900 = 11030 → test asserts `$11,030`. Consistent.
