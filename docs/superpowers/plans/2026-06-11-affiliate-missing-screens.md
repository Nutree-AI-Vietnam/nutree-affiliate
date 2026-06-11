# Affiliate Portal — Missing Screens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add payout-request workflow, monthly earnings breakdown, conversion list, admin affiliate detail page, and admin payout queue to the affiliate portal.

**Architecture:** Backend-first (API + DB migration) → frontend types + API client → UI pages. All new API handlers follow the existing pattern in `api/affiliate/stats.ts` — `verifyAuth`/`verifyAdminSession` → SQL → typed JSON response. Tests mock `sql` and `auth` modules. UI pages use `useApi()` hook + `authFetch` via `neonApi.ts`.

**Tech Stack:** Vercel serverless TypeScript (API), React 19 + TailwindCSS (UI), Neon Postgres via `@neondatabase/serverless`, Vitest + Testing Library (tests).

**Spec:** `docs/superpowers/specs/2026-06-11-affiliate-missing-screens-design.md`

---

## File Map

### New API files
- `api/affiliate/conversions.ts` — GET: list `converted` conversions for current affiliate
- `api/affiliate/monthly-earnings.ts` — GET: per-month ledger breakdown with payout status
- `api/affiliate/payout-request.ts` — POST: create payout request for a past month
- `api/admin/affiliates/[id].ts` — GET: full affiliate profile (4-tab data)
- `api/admin/payout-requests/index.ts` — GET: all payout requests (pending first)
- `api/admin/payout-requests/[id]/approve.ts` — POST: write ledger deduction, mark paid

### New API tests
- `api/affiliate/__tests__/conversions.test.ts`
- `api/affiliate/__tests__/monthly-earnings.test.ts`
- `api/affiliate/__tests__/payout-request.test.ts`
- `api/admin/__tests__/affiliate-detail.test.ts`
- `api/admin/__tests__/payout-requests.test.ts`
- `api/admin/__tests__/payout-requests-approve.test.ts`

### New UI pages
- `src/pages/pt/Conversions.tsx` — converted subscriptions list
- `src/pages/admin/AffiliateDetail.tsx` — 4-tab affiliate profile
- `src/pages/admin/PayoutQueue.tsx` — pending + completed payout requests

### Modified files
- `api/migrate.ts` — add `period` column + unique index to `affiliate_payouts`
- `api/_lib/types.ts` — add `MonthlyEarning`, `Conversion`, `AdminPayoutRequest`, `LedgerEntry`
- `src/types/index.ts` — add `MonthlyEarning`, `Conversion`, `AdminPayoutRequest`, `LedgerEntry`, `AdminAffiliateDetail`
- `src/api/index.ts` — add 6 new methods to `AffiliateApi`
- `src/api/neonApi.ts` — implement 6 new methods
- `src/pages/pt/nav.ts` — add "Doanh thu" link
- `src/pages/pt/Dashboard.tsx` — monthly earnings section + request modal
- `src/pages/admin/Overview.tsx` — clickable rows, remove mark-paid button, add Payments nav link
- `src/App.tsx` — add 3 new routes (`/pt/conversions`, `/admin/affiliates/:id`, `/admin/payouts`)

---

## Task 1: DB Migration — add `period` to `affiliate_payouts`

**Files:**
- Modify: `api/migrate.ts`

- [ ] **Step 1: Add migration statements after the `affiliate_payouts` block**

In `api/migrate.ts`, after the `console.log("✓ affiliate_payouts")` line (around line 175), add:

```typescript
  // Add period column (YYYY-MM) for monthly payout tracking
  await sql`ALTER TABLE affiliate_payouts ADD COLUMN IF NOT EXISTS period VARCHAR(7)`;

  // Unique constraint: one request per affiliate per calendar month
  await sql`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'uq_affiliate_payouts_period') THEN
        CREATE UNIQUE INDEX uq_affiliate_payouts_period
          ON affiliate_payouts (affiliate_id, period)
          WHERE period IS NOT NULL;
      END IF;
    END $$
  `;

  console.log("✓ affiliate_payouts.period migration");
```

- [ ] **Step 2: Run migration**

```bash
cd /Users/alexnguyen/Desktop/Nut/nutree-affiliate
npx ts-node --project tsconfig.api.json api/migrate.ts
```

Expected: lines ending in `✓ affiliate_payouts.period migration` and `Migration complete`

- [ ] **Step 3: Verify column exists**

```bash
psql "$(grep DATABASE_URL .env.local | cut -d= -f2-)" -c "\d affiliate_payouts"
```

Expected: `period` column of type `character varying(7)` visible in output.

- [ ] **Step 4: Commit**

```bash
git add api/migrate.ts
git commit -m "feat: add period column and unique index to affiliate_payouts"
```

---

## Task 2: New API-layer types

**Files:**
- Modify: `api/_lib/types.ts`

- [ ] **Step 1: Add new types to `api/_lib/types.ts`**

Append to end of file:

```typescript
export interface MonthlyEarning {
  month: string;           // "2026-06"
  credits: number;
  reversals: number;
  net: number;
  payoutStatus: "accumulating" | "unrequested" | "pending" | "paid";
  payoutRequestId: string | null;
}

export interface Conversion {
  joinedAt: string;        // ISO date string
  status: "converted";
}

export interface LedgerEntry {
  id: string;
  entryType: string;
  amount: number;
  note: string | null;
  createdAt: string;
}

export interface AdminPayoutRequest {
  id: string;
  affiliateId: string;
  affiliateName: string;
  period: string;          // "2026-06"
  amount: number;
  status: "pending" | "paid";
  requestedAt: string;
  completedAt: string | null;
  adminNote: string | null;
}
```

- [ ] **Step 2: Compile check**

```bash
npx tsc --project tsconfig.api.json --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add api/_lib/types.ts
git commit -m "feat: add MonthlyEarning, Conversion, LedgerEntry, AdminPayoutRequest types"
```

---

## Task 3: `api/affiliate/conversions.ts` + test

**Files:**
- Create: `api/affiliate/conversions.ts`
- Create: `api/affiliate/__tests__/conversions.test.ts`

- [ ] **Step 1: Write the failing test**

Create `api/affiliate/__tests__/conversions.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

vi.mock("../../_lib/db", () => ({ sql: vi.fn() }));
vi.mock("../../_lib/auth", () => ({
  verifyAuth: vi.fn(),
  ApiError: class ApiError extends Error {
    constructor(public status: number, msg: string) { super(msg); }
  },
}));

import { sql } from "../../_lib/db";
import { verifyAuth } from "../../_lib/auth";

const mockSql = sql as unknown as ReturnType<typeof vi.fn>;
const mockVerifyAuth = verifyAuth as ReturnType<typeof vi.fn>;

function makeRes() {
  const res = { statusCode: 200, body: "" as unknown } as Record<string, unknown>;
  res["status"] = vi.fn((c: number) => { res["statusCode"] = c; return res; });
  res["json"] = vi.fn((d: unknown) => { res["body"] = d; return res; });
  return res;
}

describe("GET /api/affiliate/conversions", () => {
  let handler: (req: unknown, res: unknown) => Promise<void>;

  beforeAll(async () => {
    handler = (await import("../conversions")).default;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyAuth.mockResolvedValue({ uid: "fb-uid", name: "Alex", email: "a@test.com" });
  });

  it("returns 405 for non-GET", async () => {
    const req = { headers: {}, method: "POST" };
    const res = makeRes();
    await handler(req, res);
    expect(res["statusCode"]).toBe(405);
  });

  it("returns 404 if affiliate not found", async () => {
    mockSql.mockResolvedValueOnce([]);
    const req = { headers: { authorization: "Bearer tok" }, method: "GET" };
    const res = makeRes();
    await handler(req, res);
    expect(res["statusCode"]).toBe(404);
  });

  it("returns converted conversions only", async () => {
    mockSql
      .mockResolvedValueOnce([{ id: "aff-1" }])
      .mockResolvedValueOnce([
        { created_at: new Date("2026-05-10T00:00:00Z"), status: "converted" },
        { created_at: new Date("2026-04-01T00:00:00Z"), status: "converted" },
      ]);
    const req = { headers: { authorization: "Bearer tok" }, method: "GET" };
    const res = makeRes();
    await handler(req, res);
    expect(res["statusCode"]).toBe(200);
    const body = res["body"] as { joinedAt: string; status: string }[];
    expect(body).toHaveLength(2);
    expect(body[0].status).toBe("converted");
    expect(body[0].joinedAt).toBe("2026-05-10");
  });

  it("returns empty array when no conversions", async () => {
    mockSql
      .mockResolvedValueOnce([{ id: "aff-1" }])
      .mockResolvedValueOnce([]);
    const req = { headers: { authorization: "Bearer tok" }, method: "GET" };
    const res = makeRes();
    await handler(req, res);
    expect(res["statusCode"]).toBe(200);
    expect(res["body"]).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/alexnguyen/Desktop/Nut/nutree-affiliate
npx vitest run api/affiliate/__tests__/conversions.test.ts
```

Expected: FAIL — "Cannot find module '../conversions'"

- [ ] **Step 3: Implement `api/affiliate/conversions.ts`**

```typescript
// api/affiliate/conversions.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql } from "../_lib/db";
import { verifyAuth, ApiError } from "../_lib/auth";
import type { Conversion } from "../_lib/types";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  try {
    const user = await verifyAuth(req);

    const affiliates = await sql`
      SELECT id FROM affiliates WHERE auth_provider = 'neon' AND auth_subject_id = ${user.uid}
    `;
    if (affiliates.length === 0) {
      res.status(404).json({ error: "Affiliate not found" });
      return;
    }
    const affiliateId = (affiliates[0] as { id: string }).id;

    const rows = await sql`
      SELECT created_at, status
      FROM affiliate_conversions
      WHERE affiliate_id = ${affiliateId}
        AND status = 'converted'
      ORDER BY created_at DESC
    `;

    const conversions: Conversion[] = (rows as {
      created_at: Date | string;
      status: string;
    }[]).map((r) => ({
      joinedAt: (r.created_at instanceof Date
        ? r.created_at.toISOString()
        : String(r.created_at)).slice(0, 10),
      status: "converted" as const,
    }));

    res.status(200).json(conversions);
  } catch (err) {
    if (err instanceof ApiError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error("/api/affiliate/conversions error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run api/affiliate/__tests__/conversions.test.ts
```

Expected: all 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add api/affiliate/conversions.ts api/affiliate/__tests__/conversions.test.ts
git commit -m "feat: add GET /api/affiliate/conversions endpoint"
```

---

## Task 4: `api/affiliate/monthly-earnings.ts` + test

**Files:**
- Create: `api/affiliate/monthly-earnings.ts`
- Create: `api/affiliate/__tests__/monthly-earnings.test.ts`

- [ ] **Step 1: Write the failing test**

Create `api/affiliate/__tests__/monthly-earnings.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

vi.mock("../../_lib/db", () => ({ sql: vi.fn() }));
vi.mock("../../_lib/auth", () => ({
  verifyAuth: vi.fn(),
  ApiError: class ApiError extends Error {
    constructor(public status: number, msg: string) { super(msg); }
  },
}));

import { sql } from "../../_lib/db";
import { verifyAuth } from "../../_lib/auth";

const mockSql = sql as unknown as ReturnType<typeof vi.fn>;
const mockVerifyAuth = verifyAuth as ReturnType<typeof vi.fn>;

function makeRes() {
  const res = { statusCode: 200, body: "" as unknown } as Record<string, unknown>;
  res["status"] = vi.fn((c: number) => { res["statusCode"] = c; return res; });
  res["json"] = vi.fn((d: unknown) => { res["body"] = d; return res; });
  return res;
}

describe("GET /api/affiliate/monthly-earnings", () => {
  let handler: (req: unknown, res: unknown) => Promise<void>;

  beforeAll(async () => {
    handler = (await import("../monthly-earnings")).default;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyAuth.mockResolvedValue({ uid: "fb-uid", name: "Alex", email: "a@test.com" });
  });

  it("returns 404 if affiliate not found", async () => {
    mockSql.mockResolvedValueOnce([]);
    const req = { headers: { authorization: "Bearer tok" }, method: "GET" };
    const res = makeRes();
    await handler(req, res);
    expect(res["statusCode"]).toBe(404);
  });

  it("maps ledger rows to monthly earnings with payout status", async () => {
    mockSql
      .mockResolvedValueOnce([{ id: "aff-1" }])  // affiliate lookup
      .mockResolvedValueOnce([                    // ledger aggregation
        { month: "2026-04", credits: "300000", reversals: "0" },
        { month: "2026-05", credits: "600000", reversals: "300000" },
      ])
      .mockResolvedValueOnce([                    // payout requests
        { id: "req-1", period: "2026-04", status: "paid" },
      ]);

    const req = { headers: { authorization: "Bearer tok" }, method: "GET" };
    const res = makeRes();
    await handler(req, res);

    expect(res["statusCode"]).toBe(200);
    const body = res["body"] as {
      month: string; credits: number; reversals: number; net: number;
      payoutStatus: string; payoutRequestId: string | null;
    }[];
    expect(body).toHaveLength(2);
    const apr = body.find((m) => m.month === "2026-04")!;
    expect(apr.credits).toBe(300000);
    expect(apr.net).toBe(300000);
    expect(apr.payoutStatus).toBe("paid");
    expect(apr.payoutRequestId).toBe("req-1");

    const may = body.find((m) => m.month === "2026-05")!;
    expect(may.net).toBe(300000); // 600000 - 300000
    // May is a past month with net > 0 and no payout request → unrequested
    expect(may.payoutStatus).toBe("unrequested");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run api/affiliate/__tests__/monthly-earnings.test.ts
```

Expected: FAIL — "Cannot find module '../monthly-earnings'"

- [ ] **Step 3: Implement `api/affiliate/monthly-earnings.ts`**

```typescript
// api/affiliate/monthly-earnings.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql } from "../_lib/db";
import { verifyAuth, ApiError } from "../_lib/auth";
import type { MonthlyEarning } from "../_lib/types";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  try {
    const user = await verifyAuth(req);

    const affiliates = await sql`
      SELECT id FROM affiliates WHERE auth_provider = 'neon' AND auth_subject_id = ${user.uid}
    `;
    if (affiliates.length === 0) {
      res.status(404).json({ error: "Affiliate not found" });
      return;
    }
    const affiliateId = (affiliates[0] as { id: string }).id;

    // Monthly credit/reversal breakdown from ledger
    const ledgerRows = await sql`
      SELECT
        TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month,
        COALESCE(SUM(CASE WHEN entry_type = 'credit' THEN amount ELSE 0 END), 0) AS credits,
        COALESCE(SUM(CASE WHEN entry_type = 'reversal' THEN amount ELSE 0 END), 0) AS reversals
      FROM affiliate_ledger_entries
      WHERE affiliate_id = ${affiliateId}
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY DATE_TRUNC('month', created_at) DESC
    `;

    // Payout requests for this affiliate — index by period
    const payoutRows = await sql`
      SELECT id, period, status
      FROM affiliate_payouts
      WHERE affiliate_id = ${affiliateId}
        AND period IS NOT NULL
    `;
    const payoutByMonth = new Map<string, { id: string; status: string }>();
    for (const r of payoutRows as { id: string; period: string; status: string }[]) {
      payoutByMonth.set(r.period, { id: r.id, status: r.status });
    }

    // Current UTC calendar month — cannot be requested
    const now = new Date();
    const currentMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

    const earnings: MonthlyEarning[] = (ledgerRows as {
      month: string; credits: string | number; reversals: string | number;
    }[]).map((r) => {
      const credits = Number(r.credits);
      const reversals = Number(r.reversals);
      const net = credits - reversals;
      const payout = payoutByMonth.get(r.month);

      let payoutStatus: MonthlyEarning["payoutStatus"];
      if (r.month >= currentMonth) {
        payoutStatus = "accumulating";
      } else if (payout?.status === "paid") {
        payoutStatus = "paid";
      } else if (payout?.status === "pending") {
        payoutStatus = "pending";
      } else if (net > 0) {
        payoutStatus = "unrequested";
      } else {
        payoutStatus = "accumulating"; // zero net past month — nothing to request
      }

      return {
        month: r.month,
        credits,
        reversals,
        net,
        payoutStatus,
        payoutRequestId: payout?.id ?? null,
      };
    });

    res.status(200).json(earnings);
  } catch (err) {
    if (err instanceof ApiError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error("/api/affiliate/monthly-earnings error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run api/affiliate/__tests__/monthly-earnings.test.ts
```

Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add api/affiliate/monthly-earnings.ts api/affiliate/__tests__/monthly-earnings.test.ts
git commit -m "feat: add GET /api/affiliate/monthly-earnings endpoint"
```

---

## Task 5: `api/affiliate/payout-request.ts` + test

**Files:**
- Create: `api/affiliate/payout-request.ts`
- Create: `api/affiliate/__tests__/payout-request.test.ts`

- [ ] **Step 1: Write the failing test**

Create `api/affiliate/__tests__/payout-request.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

vi.mock("../../_lib/db", () => ({ sql: vi.fn() }));
vi.mock("../../_lib/auth", () => ({
  verifyAuth: vi.fn(),
  ApiError: class ApiError extends Error {
    constructor(public status: number, msg: string) { super(msg); }
  },
}));

import { sql } from "../../_lib/db";
import { verifyAuth } from "../../_lib/auth";

const mockSql = sql as unknown as ReturnType<typeof vi.fn>;
const mockVerifyAuth = verifyAuth as ReturnType<typeof vi.fn>;

function makeRes() {
  const res = { statusCode: 200, body: "" as unknown } as Record<string, unknown>;
  res["status"] = vi.fn((c: number) => { res["statusCode"] = c; return res; });
  res["json"] = vi.fn((d: unknown) => { res["body"] = d; return res; });
  return res;
}

describe("POST /api/affiliate/payout-request", () => {
  let handler: (req: unknown, res: unknown) => Promise<void>;

  beforeAll(async () => {
    handler = (await import("../payout-request")).default;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyAuth.mockResolvedValue({ uid: "fb-uid", name: "Alex", email: "a@test.com" });
  });

  it("returns 405 for non-POST", async () => {
    const req = { headers: {}, method: "GET", body: {} };
    const res = makeRes();
    await handler(req, res);
    expect(res["statusCode"]).toBe(405);
  });

  it("returns 400 if month format is invalid", async () => {
    mockSql.mockResolvedValueOnce([{ id: "aff-1" }]);
    const req = { headers: { authorization: "Bearer tok" }, method: "POST", body: { month: "06-2026" } };
    const res = makeRes();
    await handler(req, res);
    expect(res["statusCode"]).toBe(400);
  });

  it("returns 400 if month is current or future", async () => {
    mockSql.mockResolvedValueOnce([{ id: "aff-1" }]);
    const now = new Date();
    const currentMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    const req = { headers: { authorization: "Bearer tok" }, method: "POST", body: { month: currentMonth } };
    const res = makeRes();
    await handler(req, res);
    expect(res["statusCode"]).toBe(400);
  });

  it("returns 409 if payout request already exists for that month", async () => {
    mockSql
      .mockResolvedValueOnce([{ id: "aff-1" }])
      .mockResolvedValueOnce([{ net: "300000" }])  // net calculation
      .mockRejectedValueOnce(Object.assign(new Error("unique"), { code: "23505" }));  // unique violation
    const req = {
      headers: { authorization: "Bearer tok" }, method: "POST",
      body: { month: "2026-05" },
    };
    const res = makeRes();
    await handler(req, res);
    expect(res["statusCode"]).toBe(409);
  });

  it("creates payout request and returns it", async () => {
    mockSql
      .mockResolvedValueOnce([{ id: "aff-1" }])
      .mockResolvedValueOnce([{ net: "300000" }])  // net calculation
      .mockResolvedValueOnce([{
        id: "req-new", amount: 300000, status: "pending", period: "2026-05",
        requested_at: new Date("2026-06-01T00:00:00Z"),
      }]);
    const req = {
      headers: { authorization: "Bearer tok" }, method: "POST",
      body: { month: "2026-05" },
    };
    const res = makeRes();
    await handler(req, res);
    expect(res["statusCode"]).toBe(201);
    const body = res["body"] as { id: string; status: string; period: string };
    expect(body.id).toBe("req-new");
    expect(body.status).toBe("pending");
    expect(body.period).toBe("2026-05");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run api/affiliate/__tests__/payout-request.test.ts
```

Expected: FAIL — "Cannot find module '../payout-request'"

- [ ] **Step 3: Implement `api/affiliate/payout-request.ts`**

```typescript
// api/affiliate/payout-request.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql } from "../_lib/db";
import { verifyAuth, ApiError } from "../_lib/auth";

const MONTH_RE = /^\d{4}-\d{2}$/;

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  try {
    const user = await verifyAuth(req);

    const affiliates = await sql`
      SELECT id FROM affiliates WHERE auth_provider = 'neon' AND auth_subject_id = ${user.uid}
    `;
    if (affiliates.length === 0) {
      res.status(404).json({ error: "Affiliate not found" });
      return;
    }
    const affiliateId = (affiliates[0] as { id: string }).id;

    const { month } = req.body as { month?: string };
    if (!month || !MONTH_RE.test(month)) {
      res.status(400).json({ error: "month must be in YYYY-MM format" });
      return;
    }

    const now = new Date();
    const currentMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    if (month >= currentMonth) {
      res.status(400).json({ error: "Can only request payout for past months" });
      return;
    }

    // Compute net earnings for the requested month
    const netRows = await sql`
      SELECT COALESCE(SUM(CASE
        WHEN entry_type = 'credit' THEN amount
        WHEN entry_type = 'reversal' THEN -amount
        ELSE 0
      END), 0) AS net
      FROM affiliate_ledger_entries
      WHERE affiliate_id = ${affiliateId}
        AND TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') = ${month}
    `;
    const net = Number((netRows[0] as { net: string | number }).net);
    if (net <= 0) {
      res.status(400).json({ error: "No positive earnings for this month" });
      return;
    }

    try {
      const inserted = await sql`
        INSERT INTO affiliate_payouts (affiliate_id, amount, status, period, requested_at)
        VALUES (${affiliateId}, ${net}, 'pending', ${month}, NOW())
        RETURNING id, amount, status, period, requested_at
      `;
      const row = inserted[0] as {
        id: string; amount: number; status: string; period: string; requested_at: Date;
      };
      res.status(201).json({
        id: row.id,
        amount: Number(row.amount),
        status: row.status,
        period: row.period,
        requestedAt: (row.requested_at instanceof Date
          ? row.requested_at.toISOString()
          : String(row.requested_at)),
      });
    } catch (dbErr) {
      if ((dbErr as { code?: string }).code === "23505") {
        res.status(409).json({ error: "Payout already requested for this month" });
        return;
      }
      throw dbErr;
    }
  } catch (err) {
    if (err instanceof ApiError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error("/api/affiliate/payout-request error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run api/affiliate/__tests__/payout-request.test.ts
```

Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add api/affiliate/payout-request.ts api/affiliate/__tests__/payout-request.test.ts
git commit -m "feat: add POST /api/affiliate/payout-request endpoint"
```

---

## Task 6: `api/admin/affiliates/[id].ts` + test

**Files:**
- Create: `api/admin/affiliates/[id].ts`
- Create: `api/admin/__tests__/affiliate-detail.test.ts`

- [ ] **Step 1: Write the failing test**

Create `api/admin/__tests__/affiliate-detail.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

vi.mock("../../_lib/db", () => ({ sql: vi.fn() }));
vi.mock("../../_lib/auth", () => ({
  verifyAdminSession: vi.fn(),
  ApiError: class ApiError extends Error {
    constructor(public status: number, msg: string) { super(msg); }
  },
}));

import { sql } from "../../_lib/db";
import { verifyAdminSession } from "../../_lib/auth";

const mockSql = sql as unknown as ReturnType<typeof vi.fn>;
const mockVerifyAdminSession = verifyAdminSession as ReturnType<typeof vi.fn>;

function makeRes() {
  const res = { statusCode: 200, body: "" as unknown } as Record<string, unknown>;
  res["status"] = vi.fn((c: number) => { res["statusCode"] = c; return res; });
  res["json"] = vi.fn((d: unknown) => { res["body"] = d; return res; });
  return res;
}

describe("GET /api/admin/affiliates/:id", () => {
  let handler: (req: unknown, res: unknown) => Promise<void>;

  beforeAll(async () => {
    handler = (await import("../affiliates/[id]")).default;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyAdminSession.mockReturnValue({ affiliateId: "admin-1" });
  });

  it("returns 404 if affiliate not found", async () => {
    mockSql.mockResolvedValueOnce([]);
    const req = { headers: { authorization: "Bearer admin.x.y" }, method: "GET", query: { id: "aff-999" } };
    const res = makeRes();
    await handler(req, res);
    expect(res["statusCode"]).toBe(404);
  });

  it("returns full affiliate detail", async () => {
    mockSql
      .mockResolvedValueOnce([{
        id: "aff-1", display_name: "Alex", status: "active",
        bank_info: { bankName: "VCB", accountHolder: "ALEX", accountNumber: "1234" },
      }])
      .mockResolvedValueOnce([{ code: "ALEX01" }])
      .mockResolvedValueOnce([
        { month: "2026-05", credits: "300000", reversals: "0" },
      ])
      .mockResolvedValueOnce([])   // payout requests
      .mockResolvedValueOnce([    // conversions
        { created_at: new Date("2026-05-01"), status: "converted" },
      ])
      .mockResolvedValueOnce([    // ledger entries
        { id: "led-1", entry_type: "credit", amount: "300000", note: null, created_at: new Date("2026-05-01") },
      ]);

    const req = { headers: { authorization: "Bearer admin.x.y" }, method: "GET", query: { id: "aff-1" } };
    const res = makeRes();
    await handler(req, res);

    expect(res["statusCode"]).toBe(200);
    const body = res["body"] as {
      affiliateId: string; name: string; code: string; status: string;
      bankInfo: unknown; monthlyEarnings: unknown[]; conversions: unknown[]; ledgerEntries: unknown[];
    };
    expect(body.affiliateId).toBe("aff-1");
    expect(body.code).toBe("ALEX01");
    expect(body.bankInfo).toMatchObject({ bankName: "VCB" });
    expect(body.monthlyEarnings).toHaveLength(1);
    expect(body.conversions).toHaveLength(1);
    expect(body.ledgerEntries).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run api/admin/__tests__/affiliate-detail.test.ts
```

Expected: FAIL — "Cannot find module '../affiliates/[id]'"

- [ ] **Step 3: Implement `api/admin/affiliates/[id].ts`**

```typescript
// api/admin/affiliates/[id].ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql } from "../../_lib/db";
import { verifyAdminSession, ApiError } from "../../_lib/auth";
import type { MonthlyEarning, Conversion, LedgerEntry } from "../../_lib/types";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  try {
    verifyAdminSession(req);

    const affiliateId = req.query.id as string;

    const affiliateRows = await sql`
      SELECT id, display_name, status, bank_info
      FROM affiliates WHERE id = ${affiliateId}
    `;
    if (affiliateRows.length === 0) {
      res.status(404).json({ error: "Affiliate not found" });
      return;
    }
    const aff = affiliateRows[0] as {
      id: string; display_name: string; status: string; bank_info: unknown;
    };

    const codeRows = await sql`
      SELECT code FROM affiliate_codes WHERE affiliate_id = ${affiliateId} AND status = 'active' LIMIT 1
    `;
    const code = (codeRows[0] as { code?: string } | undefined)?.code ?? "";

    const ledgerRows = await sql`
      SELECT
        TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month,
        COALESCE(SUM(CASE WHEN entry_type = 'credit' THEN amount ELSE 0 END), 0) AS credits,
        COALESCE(SUM(CASE WHEN entry_type = 'reversal' THEN amount ELSE 0 END), 0) AS reversals
      FROM affiliate_ledger_entries
      WHERE affiliate_id = ${affiliateId}
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY DATE_TRUNC('month', created_at) DESC
    `;

    const payoutRows = await sql`
      SELECT id, period, status FROM affiliate_payouts
      WHERE affiliate_id = ${affiliateId} AND period IS NOT NULL
    `;
    const payoutByMonth = new Map<string, { id: string; status: string }>();
    for (const r of payoutRows as { id: string; period: string; status: string }[]) {
      payoutByMonth.set(r.period, { id: r.id, status: r.status });
    }

    const now = new Date();
    const currentMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

    const monthlyEarnings: MonthlyEarning[] = (ledgerRows as {
      month: string; credits: string | number; reversals: string | number;
    }[]).map((r) => {
      const credits = Number(r.credits);
      const reversals = Number(r.reversals);
      const net = credits - reversals;
      const payout = payoutByMonth.get(r.month);
      let payoutStatus: MonthlyEarning["payoutStatus"];
      if (r.month >= currentMonth) payoutStatus = "accumulating";
      else if (payout?.status === "paid") payoutStatus = "paid";
      else if (payout?.status === "pending") payoutStatus = "pending";
      else if (net > 0) payoutStatus = "unrequested";
      else payoutStatus = "accumulating";
      return { month: r.month, credits, reversals, net, payoutStatus, payoutRequestId: payout?.id ?? null };
    });

    const convRows = await sql`
      SELECT created_at, status FROM affiliate_conversions
      WHERE affiliate_id = ${affiliateId} AND status = 'converted'
      ORDER BY created_at DESC
    `;
    const conversions: Conversion[] = (convRows as { created_at: Date | string; status: string }[]).map((r) => ({
      joinedAt: (r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at)).slice(0, 10),
      status: "converted" as const,
    }));

    const entryRows = await sql`
      SELECT id, entry_type, amount, note, created_at
      FROM affiliate_ledger_entries
      WHERE affiliate_id = ${affiliateId}
      ORDER BY created_at DESC
    `;
    const ledgerEntries: LedgerEntry[] = (entryRows as {
      id: string; entry_type: string; amount: number; note: string | null; created_at: Date | string;
    }[]).map((r) => ({
      id: r.id,
      entryType: r.entry_type,
      amount: Number(r.amount),
      note: r.note,
      createdAt: (r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at)),
    }));

    res.status(200).json({
      affiliateId: aff.id,
      name: aff.display_name,
      code,
      status: aff.status,
      bankInfo: aff.bank_info ?? null,
      monthlyEarnings,
      conversions,
      ledgerEntries,
    });
  } catch (err) {
    if (err instanceof ApiError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error("/api/admin/affiliates/[id] error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run api/admin/__tests__/affiliate-detail.test.ts
```

Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add "api/admin/affiliates/[id].ts" api/admin/__tests__/affiliate-detail.test.ts
git commit -m "feat: add GET /api/admin/affiliates/:id endpoint"
```

---

## Task 7: `api/admin/payout-requests/index.ts` + test

**Files:**
- Create: `api/admin/payout-requests/index.ts`
- Create: `api/admin/__tests__/payout-requests.test.ts`

- [ ] **Step 1: Write the failing test**

Create `api/admin/__tests__/payout-requests.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

vi.mock("../../_lib/db", () => ({ sql: vi.fn() }));
vi.mock("../../_lib/auth", () => ({
  verifyAdminSession: vi.fn(),
  ApiError: class ApiError extends Error {
    constructor(public status: number, msg: string) { super(msg); }
  },
}));

import { sql } from "../../_lib/db";
import { verifyAdminSession } from "../../_lib/auth";

const mockSql = sql as unknown as ReturnType<typeof vi.fn>;
const mockVerifyAdminSession = verifyAdminSession as ReturnType<typeof vi.fn>;

function makeRes() {
  const res = { statusCode: 200, body: "" as unknown } as Record<string, unknown>;
  res["status"] = vi.fn((c: number) => { res["statusCode"] = c; return res; });
  res["json"] = vi.fn((d: unknown) => { res["body"] = d; return res; });
  return res;
}

describe("GET /api/admin/payout-requests", () => {
  let handler: (req: unknown, res: unknown) => Promise<void>;

  beforeAll(async () => {
    handler = (await import("../payout-requests/index")).default;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyAdminSession.mockReturnValue({ affiliateId: "admin-1" });
  });

  it("returns pending requests first then paid", async () => {
    mockSql.mockResolvedValueOnce([
      { id: "req-1", affiliate_id: "aff-1", affiliate_name: "Alex", period: "2026-05",
        amount: "300000", status: "pending", requested_at: new Date("2026-06-01"), completed_at: null, admin_note: null },
      { id: "req-2", affiliate_id: "aff-2", affiliate_name: "Bob", period: "2026-04",
        amount: "600000", status: "paid", requested_at: new Date("2026-05-01"), completed_at: new Date("2026-05-15"), admin_note: "Done" },
    ]);

    const req = { headers: { authorization: "Bearer admin.x.y" }, method: "GET" };
    const res = makeRes();
    await handler(req, res);

    expect(res["statusCode"]).toBe(200);
    const body = res["body"] as { id: string; status: string }[];
    expect(body).toHaveLength(2);
    expect(body[0].status).toBe("pending");
    expect(body[1].status).toBe("paid");
  });

  it("returns empty array when no requests", async () => {
    mockSql.mockResolvedValueOnce([]);
    const req = { headers: { authorization: "Bearer admin.x.y" }, method: "GET" };
    const res = makeRes();
    await handler(req, res);
    expect(res["statusCode"]).toBe(200);
    expect(res["body"]).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run api/admin/__tests__/payout-requests.test.ts
```

Expected: FAIL — "Cannot find module '../payout-requests/index'"

- [ ] **Step 3: Implement `api/admin/payout-requests/index.ts`**

```typescript
// api/admin/payout-requests/index.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql } from "../../_lib/db";
import { verifyAdminSession, ApiError } from "../../_lib/auth";
import type { AdminPayoutRequest } from "../../_lib/types";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  try {
    verifyAdminSession(req);

    const rows = await sql`
      SELECT
        p.id, p.affiliate_id, a.display_name AS affiliate_name,
        p.period, p.amount, p.status, p.requested_at, p.completed_at, p.admin_note
      FROM affiliate_payouts p
      JOIN affiliates a ON a.id = p.affiliate_id
      WHERE p.period IS NOT NULL
      ORDER BY
        CASE WHEN p.status = 'pending' THEN 0 ELSE 1 END,
        p.requested_at ASC
    `;

    const requests: AdminPayoutRequest[] = (rows as {
      id: string; affiliate_id: string; affiliate_name: string; period: string;
      amount: number; status: string; requested_at: Date | string;
      completed_at: Date | string | null; admin_note: string | null;
    }[]).map((r) => ({
      id: r.id,
      affiliateId: r.affiliate_id,
      affiliateName: r.affiliate_name,
      period: r.period,
      amount: Number(r.amount),
      status: r.status as "pending" | "paid",
      requestedAt: (r.requested_at instanceof Date ? r.requested_at.toISOString() : String(r.requested_at)),
      completedAt: r.completed_at
        ? (r.completed_at instanceof Date ? r.completed_at.toISOString() : String(r.completed_at))
        : null,
      adminNote: r.admin_note,
    }));

    res.status(200).json(requests);
  } catch (err) {
    if (err instanceof ApiError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error("/api/admin/payout-requests error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run api/admin/__tests__/payout-requests.test.ts
```

Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add api/admin/payout-requests/index.ts api/admin/__tests__/payout-requests.test.ts
git commit -m "feat: add GET /api/admin/payout-requests endpoint"
```

---

## Task 8: `api/admin/payout-requests/[id]/approve.ts` + test

**Files:**
- Create: `api/admin/payout-requests/[id]/approve.ts`
- Create: `api/admin/__tests__/payout-requests-approve.test.ts`

- [ ] **Step 1: Write the failing test**

Create `api/admin/__tests__/payout-requests-approve.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

vi.mock("../../_lib/db", () => ({ sql: vi.fn() }));
vi.mock("../../_lib/auth", () => ({
  verifyAdminSession: vi.fn(),
  ApiError: class ApiError extends Error {
    constructor(public status: number, msg: string) { super(msg); }
  },
}));

import { sql } from "../../_lib/db";
import { verifyAdminSession } from "../../_lib/auth";

const mockSql = sql as unknown as ReturnType<typeof vi.fn>;
const mockVerifyAdminSession = verifyAdminSession as ReturnType<typeof vi.fn>;

function makeRes() {
  const res = { statusCode: 200, body: "" as unknown } as Record<string, unknown>;
  res["status"] = vi.fn((c: number) => { res["statusCode"] = c; return res; });
  res["json"] = vi.fn((d: unknown) => { res["body"] = d; return res; });
  return res;
}

describe("POST /api/admin/payout-requests/:id/approve", () => {
  let handler: (req: unknown, res: unknown) => Promise<void>;

  beforeAll(async () => {
    handler = (await import("../payout-requests/[id]/approve")).default;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyAdminSession.mockReturnValue({ affiliateId: "admin-1" });
  });

  it("returns 404 if request not found", async () => {
    mockSql.mockResolvedValueOnce([]);
    const req = { headers: { authorization: "Bearer admin.x.y" }, method: "POST",
      query: { id: "req-999" }, body: {} };
    const res = makeRes();
    await handler(req, res);
    expect(res["statusCode"]).toBe(404);
  });

  it("returns 409 if already paid", async () => {
    mockSql.mockResolvedValueOnce([{ id: "req-1", status: "paid", affiliate_id: "aff-1", amount: "300000", period: "2026-05" }]);
    const req = { headers: { authorization: "Bearer admin.x.y" }, method: "POST",
      query: { id: "req-1" }, body: {} };
    const res = makeRes();
    await handler(req, res);
    expect(res["statusCode"]).toBe(409);
  });

  it("approves and writes ledger deduction", async () => {
    mockSql
      .mockResolvedValueOnce([{ id: "req-1", status: "pending", affiliate_id: "aff-1", amount: "300000", period: "2026-05" }])
      .mockResolvedValueOnce([])  // insert ledger entry
      .mockResolvedValueOnce([{ id: "req-1", status: "paid", period: "2026-05", completed_at: new Date() }]); // update payout

    const req = { headers: { authorization: "Bearer admin.x.y" }, method: "POST",
      query: { id: "req-1" }, body: { note: "Paid via bank transfer" } };
    const res = makeRes();
    await handler(req, res);

    expect(res["statusCode"]).toBe(200);
    const body = res["body"] as { status: string; period: string };
    expect(body.status).toBe("paid");
    expect(body.period).toBe("2026-05");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run api/admin/__tests__/payout-requests-approve.test.ts
```

Expected: FAIL — "Cannot find module '../payout-requests/[id]/approve'"

- [ ] **Step 3: Implement `api/admin/payout-requests/[id]/approve.ts`**

```typescript
// api/admin/payout-requests/[id]/approve.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql } from "../../../_lib/db";
import { verifyAdminSession, ApiError } from "../../../_lib/auth";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  try {
    verifyAdminSession(req);

    const requestId = req.query.id as string;
    const { note } = (req.body ?? {}) as { note?: string };

    const payoutRows = await sql`
      SELECT id, status, affiliate_id, amount, period
      FROM affiliate_payouts WHERE id = ${requestId}
    `;
    if (payoutRows.length === 0) {
      res.status(404).json({ error: "Payout request not found" });
      return;
    }
    const payout = payoutRows[0] as {
      id: string; status: string; affiliate_id: string; amount: number; period: string;
    };
    if (payout.status === "paid") {
      res.status(409).json({ error: "Already paid" });
      return;
    }

    // Write ledger deduction
    await sql`
      INSERT INTO affiliate_ledger_entries
        (affiliate_id, entry_type, amount, idempotency_key, note)
      VALUES (
        ${payout.affiliate_id},
        'payout_deduction',
        ${Number(payout.amount)},
        ${"payout_" + requestId},
        ${note ?? null}
      )
      ON CONFLICT (idempotency_key) DO NOTHING
    `;

    // Mark payout as paid
    const updated = await sql`
      UPDATE affiliate_payouts
      SET status = 'paid', completed_at = NOW(), admin_note = ${note ?? null}
      WHERE id = ${requestId}
      RETURNING id, status, period, completed_at, admin_note
    `;
    const row = updated[0] as {
      id: string; status: string; period: string; completed_at: Date | string; admin_note: string | null;
    };

    res.status(200).json({
      id: row.id,
      status: row.status,
      period: row.period,
      completedAt: row.completed_at instanceof Date ? row.completed_at.toISOString() : String(row.completed_at),
      adminNote: row.admin_note,
    });
  } catch (err) {
    if (err instanceof ApiError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error("/api/admin/payout-requests/[id]/approve error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run api/admin/__tests__/payout-requests-approve.test.ts
```

Expected: all tests PASS

- [ ] **Step 5: Run full test suite**

```bash
npm test
```

Expected: all tests pass (green)

- [ ] **Step 6: Commit**

```bash
git add "api/admin/payout-requests/[id]/approve.ts" api/admin/__tests__/payout-requests-approve.test.ts
git commit -m "feat: add POST /api/admin/payout-requests/:id/approve endpoint"
```

---

## Task 9: Frontend types + AffiliateApi interface

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/api/index.ts`

- [ ] **Step 1: Add new types to `src/types/index.ts`**

Append to end of `src/types/index.ts`:

```typescript
export interface MonthlyEarning {
  month: string;           // "2026-06"
  credits: number;
  reversals: number;
  net: number;
  payoutStatus: "accumulating" | "unrequested" | "pending" | "paid";
  payoutRequestId: string | null;
}

export interface Conversion {
  joinedAt: string;
  status: "converted";
}

export interface LedgerEntry {
  id: string;
  entryType: string;
  amount: number;
  note: string | null;
  createdAt: string;
}

export interface AdminPayoutRequest {
  id: string;
  affiliateId: string;
  affiliateName: string;
  period: string;
  amount: number;
  status: "pending" | "paid";
  requestedAt: string;
  completedAt: string | null;
  adminNote: string | null;
}

export interface AdminAffiliateDetail {
  affiliateId: string;
  name: string;
  code: string;
  status: string;
  bankInfo: BankInfo | null;
  monthlyEarnings: MonthlyEarning[];
  conversions: Conversion[];
  ledgerEntries: LedgerEntry[];
}
```

- [ ] **Step 2: Add new methods to `AffiliateApi` interface in `src/api/index.ts`**

In `src/api/index.ts`, update the import:

```typescript
import type {
  Session, MyStats, ReferralInfo, BankInfo, Payout, AdminOverview,
  MonthlyEarning, Conversion, AdminPayoutRequest, AdminAffiliateDetail,
} from "../types";
```

Then add to `AffiliateApi` interface (after `getCommissionSetting`):

```typescript
  getMyConversions(): Promise<Conversion[]>;
  getMyMonthlyEarnings(): Promise<MonthlyEarning[]>;
  requestPayout(month: string): Promise<{ id: string; status: string; period: string; requestedAt: string }>;

  getAdminAffiliateDetail(affiliateId: string): Promise<AdminAffiliateDetail>;
  getAdminPayoutRequests(): Promise<AdminPayoutRequest[]>;
  approvePayoutRequest(requestId: string, note?: string): Promise<{ status: string; period: string }>;
```

- [ ] **Step 3: Compile check**

```bash
npx tsc -b --noEmit
```

Expected: errors about missing method implementations in `neonApi.ts` and `mockApi.ts` — that's expected; we fix in Task 10.

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts src/api/index.ts
git commit -m "feat: add frontend types and AffiliateApi interface for missing screens"
```

---

## Task 10: Implement new methods in `neonApi.ts`

**Files:**
- Modify: `src/api/neonApi.ts`

- [ ] **Step 1: Update imports in `neonApi.ts`**

Update the type import at the top of `src/api/neonApi.ts`:

```typescript
import type {
  Session, MyStats, ReferralInfo, BankInfo, Payout, AdminOverview, AffiliateRow,
  MonthlyEarning, Conversion, AdminPayoutRequest, AdminAffiliateDetail, LedgerEntry,
} from "../types";
```

- [ ] **Step 2: Add 6 new method implementations inside `createNeonApi()`**

After the `getCommissionSetting` method and before the closing `};` of the returned object:

```typescript
    async getMyConversions(): Promise<Conversion[]> {
      return authFetch<Conversion[]>("/affiliate/conversions");
    },

    async getMyMonthlyEarnings(): Promise<MonthlyEarning[]> {
      return authFetch<MonthlyEarning[]>("/affiliate/monthly-earnings");
    },

    async requestPayout(month: string): Promise<{ id: string; status: string; period: string; requestedAt: string }> {
      return authFetch("/affiliate/payout-request", {
        method: "POST",
        body: JSON.stringify({ month }),
      });
    },

    async getAdminAffiliateDetail(affiliateId: string): Promise<AdminAffiliateDetail> {
      const data = await authFetch<{
        affiliateId: string; name: string; code: string; status: string;
        bankInfo: BankInfo | null; monthlyEarnings: MonthlyEarning[];
        conversions: Conversion[]; ledgerEntries: LedgerEntry[];
      }>(`/admin/affiliates/${affiliateId}`);
      return data;
    },

    async getAdminPayoutRequests(): Promise<AdminPayoutRequest[]> {
      return authFetch<AdminPayoutRequest[]>("/admin/payout-requests");
    },

    async approvePayoutRequest(requestId: string, note?: string): Promise<{ status: string; period: string }> {
      return authFetch(`/admin/payout-requests/${requestId}/approve`, {
        method: "POST",
        body: JSON.stringify({ note: note ?? null }),
      });
    },
```

- [ ] **Step 3: Fix `mockApi.ts` stubs** — add stub implementations for the 6 new methods so TypeScript doesn't complain. Open `src/api/mockApi.ts` and add after existing methods:

```typescript
    async getMyConversions() { return []; },
    async getMyMonthlyEarnings() { return []; },
    async requestPayout() { return { id: "", status: "pending", period: "", requestedAt: "" }; },
    async getAdminAffiliateDetail() {
      return { affiliateId: "", name: "", code: "", status: "", bankInfo: null, monthlyEarnings: [], conversions: [], ledgerEntries: [] };
    },
    async getAdminPayoutRequests() { return []; },
    async approvePayoutRequest() { return { status: "paid", period: "" }; },
```

- [ ] **Step 4: Compile check**

```bash
npx tsc -b --noEmit
```

Expected: no errors

- [ ] **Step 5: Run tests**

```bash
npm test
```

Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add src/api/neonApi.ts src/api/mockApi.ts
git commit -m "feat: implement neonApi methods for conversions, monthly-earnings, payout-request, admin detail"
```

---

## Task 11: `src/pages/pt/Conversions.tsx`

**Files:**
- Create: `src/pages/pt/Conversions.tsx`

- [ ] **Step 1: Create `src/pages/pt/Conversions.tsx`**

```tsx
// src/pages/pt/Conversions.tsx
import { useEffect, useState } from "react";
import { useApi } from "../../api";
import { NavBar } from "../../components/NavBar";
import { DataTable } from "../../components/DataTable";
import { ptLinks } from "./nav";
import type { Conversion } from "../../types";

export function Conversions() {
  const api = useApi();
  const [conversions, setConversions] = useState<Conversion[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getMyConversions()
      .then(setConversions)
      .catch((e) => setError(e instanceof Error ? e.message : "Không thể tải dữ liệu"))
      .finally(() => setLoading(false));
  }, [api]);

  return (
    <div>
      <NavBar title="Affiliate" links={ptLinks} />
      <main className="mx-auto max-w-5xl p-6">
        {error && (
          <p className="mb-4 rounded-xl bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
        {loading ? (
          <p className="text-gray-400 text-sm">Đang tải…</p>
        ) : (
          <div className="rounded-2xl bg-white dark:bg-[#2D2D2D] p-5 shadow-sm ring-1 ring-black/5 dark:ring-white/10">
            <div className="mb-4 text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#29B6A1" }}>
              Người dùng đã chuyển đổi
            </div>
            <DataTable
              rows={conversions.map((c, i) => ({ ...c, _idx: i + 1 }))}
              rowKey={(c) => String(c._idx)}
              empty="Chia sẻ mã của bạn để bắt đầu"
              columns={[
                { key: "_idx", header: "#" },
                { key: "joinedAt", header: "Ngày đăng ký" },
                {
                  key: "status", header: "Trạng thái",
                  render: () => (
                    <span className="rounded-full bg-[#E6F7F5] dark:bg-[#29B6A1]/20 px-2.5 py-0.5 text-xs font-semibold text-[#1A4739] dark:text-[#29B6A1]">
                      Đang đăng ký
                    </span>
                  ),
                },
              ]}
            />
          </div>
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Compile check**

```bash
npx tsc -b --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/pages/pt/Conversions.tsx
git commit -m "feat: add Conversions page for PT affiliates"
```

---

## Task 12: `src/pages/pt/Dashboard.tsx` — monthly earnings section

**Files:**
- Modify: `src/pages/pt/Dashboard.tsx`

The Dashboard needs a second section below the payout history: a monthly earnings table with a "Yêu cầu thanh toán" button + confirmation modal.

- [ ] **Step 1: Update Dashboard state and data loading**

Add at the top of the `Dashboard` function (after existing state):

```tsx
  const [monthlyEarnings, setMonthlyEarnings] = useState<MonthlyEarning[]>([]);
  const [requestingMonth, setRequestingMonth] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestLoading, setRequestLoading] = useState(false);
```

Update the import line to include `MonthlyEarning`:

```tsx
import type { MyStats, ReferralInfo, Payout, MonthlyEarning } from "../../types";
```

Update `useEffect` to also load monthly earnings:

```tsx
  useEffect(() => {
    Promise.all([api.getMyStats(), api.getMyReferral(), api.getMyPayouts(), api.getMyMonthlyEarnings()])
      .then(([s, r, p, m]) => { setStats(s); setReferral(r); setPayouts(p); setMonthlyEarnings(m); })
      .catch((e) => setError(e instanceof Error ? e.message : "Không thể tải dữ liệu"));
  }, [api]);
```

- [ ] **Step 2: Add helper and modal for payout requests**

Add after `saveCode` function:

```tsx
  const submitPayoutRequest = async (month: string) => {
    setRequestLoading(true);
    setRequestError(null);
    try {
      const result = await api.requestPayout(month);
      setMonthlyEarnings((prev) =>
        prev.map((m) => m.month === result.period
          ? { ...m, payoutStatus: "pending", payoutRequestId: result.id }
          : m
        )
      );
      setRequestingMonth(null);
    } catch (e) {
      setRequestError(e instanceof Error ? e.message : "Lỗi không xác định");
    } finally {
      setRequestLoading(false);
    }
  };
```

- [ ] **Step 3: Add monthly earnings section to JSX**

Add directly after the closing `</div>` of the payout history section (before the outer `</>`):

```tsx
            {monthlyEarnings.length > 0 && (
              <div className="mt-6 rounded-2xl bg-white dark:bg-[#2D2D2D] p-5 shadow-sm ring-1 ring-black/5 dark:ring-white/10">
                <div className="mb-4 text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#29B6A1" }}>
                  Thu nhập theo tháng
                </div>
                <DataTable
                  rows={monthlyEarnings}
                  rowKey={(m) => m.month}
                  empty=""
                  columns={[
                    { key: "month", header: "Tháng" },
                    { key: "credits", header: "Hoa hồng", render: (m) => currency(m.credits) },
                    { key: "reversals", header: "Khấu trừ", render: (m) => currency(m.reversals) },
                    { key: "net", header: "Thực nhận", render: (m) => currency(m.net) },
                    {
                      key: "payoutStatus", header: "Trạng thái",
                      render: (m) => {
                        if (m.payoutStatus === "paid") return <span className="rounded-full bg-[#E6F7F5] dark:bg-[#29B6A1]/20 px-2.5 py-0.5 text-xs font-semibold text-[#1A4739] dark:text-[#29B6A1]">✓ Đã thanh toán</span>;
                        if (m.payoutStatus === "pending") return <span className="rounded-full bg-amber-50 dark:bg-amber-900/20 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400">Chờ xử lý</span>;
                        if (m.payoutStatus === "accumulating") return <span className="text-xs text-gray-400">Đang tích lũy</span>;
                        return null; // unrequested — show action button in next column
                      },
                    },
                    {
                      key: "action", header: "",
                      render: (m) => m.payoutStatus === "unrequested"
                        ? (
                          <button
                            onClick={() => { setRequestingMonth(m.month); setRequestError(null); }}
                            className="rounded-xl px-3 py-1.5 text-xs font-semibold text-white transition-all hover:opacity-80 active:scale-95"
                            style={{ background: "linear-gradient(135deg, #1A4739 0%, #29B6A1 100%)" }}
                          >
                            Yêu cầu thanh toán
                          </button>
                        )
                        : null,
                    },
                  ]}
                />
              </div>
            )}

            {/* Payout request modal */}
            {requestingMonth && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#2D2D2D] p-6 shadow-xl ring-1 ring-black/10 dark:ring-white/10">
                  <div className="mb-1 text-base font-bold text-gray-900 dark:text-white">Yêu cầu thanh toán</div>
                  <div className="mb-4 text-sm text-gray-500 dark:text-gray-400">
                    Tháng: <span className="font-semibold text-gray-800 dark:text-white">{requestingMonth}</span>
                    {" · "}
                    Số tiền: <span className="font-semibold text-gray-800 dark:text-white">
                      {currency(monthlyEarnings.find((m) => m.month === requestingMonth)?.net ?? 0)}
                    </span>
                  </div>
                  {requestError && <p className="mb-3 text-xs text-red-500">{requestError}</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={() => submitPayoutRequest(requestingMonth)}
                      disabled={requestLoading}
                      className="flex-1 rounded-xl py-2 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
                      style={{ background: "linear-gradient(135deg, #1A4739 0%, #29B6A1 100%)" }}
                    >
                      {requestLoading ? "Đang gửi…" : "Xác nhận"}
                    </button>
                    <button
                      onClick={() => { setRequestingMonth(null); setRequestError(null); }}
                      className="flex-1 rounded-xl border border-gray-200 dark:border-white/10 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5"
                    >
                      Huỷ
                    </button>
                  </div>
                </div>
              </div>
            )}
```

- [ ] **Step 4: Compile check**

```bash
npx tsc -b --noEmit
```

Expected: no errors

- [ ] **Step 5: Run tests**

```bash
npm test
```

Expected: all pass

- [ ] **Step 6: Commit**

```bash
git add src/pages/pt/Dashboard.tsx
git commit -m "feat: add monthly earnings section with payout request modal to Dashboard"
```

---

## Task 13: `src/pages/admin/AffiliateDetail.tsx`

**Files:**
- Create: `src/pages/admin/AffiliateDetail.tsx`

- [ ] **Step 1: Create `src/pages/admin/AffiliateDetail.tsx`**

```tsx
// src/pages/admin/AffiliateDetail.tsx
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useApi } from "../../api";
import { NavBar } from "../../components/NavBar";
import { DataTable } from "../../components/DataTable";
import { currency } from "../../lib/format";
import type { AdminAffiliateDetail } from "../../types";

const adminLinks = [
  { to: "/admin", label: "Tổng quan" },
  { to: "/admin/payouts", label: "Thanh toán" },
];

type Tab = "profile" | "earnings" | "conversions" | "ledger";

export function AffiliateDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const api = useApi();
  const [detail, setDetail] = useState<AdminAffiliateDetail | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("profile");

  useEffect(() => {
    if (!id) return;
    api.getAdminAffiliateDetail(id)
      .then(setDetail)
      .catch((e) => setError(e instanceof Error ? e.message : "Không thể tải"));
  }, [api, id]);

  const tabClass = (t: Tab) =>
    `px-4 py-2 text-sm font-semibold rounded-t-xl transition ${
      tab === t
        ? "border-b-2 border-[#29B6A1] text-[#29B6A1]"
        : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white"
    }`;

  return (
    <div>
      <NavBar title="Admin" links={adminLinks} />
      <main className="mx-auto max-w-5xl p-6">
        <button
          onClick={() => navigate("/admin")}
          className="mb-4 text-sm text-[#29B6A1] hover:underline"
        >
          ← Quay lại
        </button>
        {error && (
          <p className="mb-4 rounded-xl bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
        {!detail ? (
          <p className="text-sm text-gray-400">Đang tải…</p>
        ) : (
          <>
            {/* Header */}
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{detail.name}</h1>
              <span className="rounded-full bg-gray-100 dark:bg-white/10 px-3 py-1 text-sm font-mono font-semibold text-gray-700 dark:text-gray-300">
                {detail.code}
              </span>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                detail.status === "active"
                  ? "bg-[#E6F7F5] dark:bg-[#29B6A1]/20 text-[#1A4739] dark:text-[#29B6A1]"
                  : "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400"
              }`}>
                {detail.status}
              </span>
            </div>

            {/* Tabs */}
            <div className="mb-0 flex gap-1 border-b border-gray-200 dark:border-white/10">
              <button className={tabClass("profile")} onClick={() => setTab("profile")}>Hồ sơ</button>
              <button className={tabClass("earnings")} onClick={() => setTab("earnings")}>Thu nhập</button>
              <button className={tabClass("conversions")} onClick={() => setTab("conversions")}>Chuyển đổi</button>
              <button className={tabClass("ledger")} onClick={() => setTab("ledger")}>Sổ cái</button>
            </div>

            <div className="rounded-b-2xl rounded-tr-2xl bg-white dark:bg-[#2D2D2D] p-5 shadow-sm ring-1 ring-black/5 dark:ring-white/10">
              {tab === "profile" && (
                <div>
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#29B6A1" }}>
                    Thông tin ngân hàng
                  </div>
                  {detail.bankInfo ? (
                    <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                      <div><dt className="text-gray-500 dark:text-gray-400">Ngân hàng</dt><dd className="font-semibold text-gray-900 dark:text-white">{detail.bankInfo.bankName}</dd></div>
                      <div><dt className="text-gray-500 dark:text-gray-400">Chủ tài khoản</dt><dd className="font-semibold text-gray-900 dark:text-white">{detail.bankInfo.accountHolder}</dd></div>
                      <div><dt className="text-gray-500 dark:text-gray-400">Số tài khoản</dt><dd className="font-semibold font-mono text-gray-900 dark:text-white">{detail.bankInfo.accountNumber}</dd></div>
                      {detail.bankInfo.routingOrSwift && (
                        <div><dt className="text-gray-500 dark:text-gray-400">Routing/SWIFT</dt><dd className="font-semibold font-mono text-gray-900 dark:text-white">{detail.bankInfo.routingOrSwift}</dd></div>
                      )}
                    </dl>
                  ) : (
                    <p className="text-sm text-gray-400">Chưa có thông tin ngân hàng</p>
                  )}
                </div>
              )}

              {tab === "earnings" && (
                <DataTable
                  rows={detail.monthlyEarnings}
                  rowKey={(m) => m.month}
                  empty="Chưa có dữ liệu thu nhập"
                  columns={[
                    { key: "month", header: "Tháng" },
                    { key: "credits", header: "Hoa hồng", render: (m) => currency(m.credits) },
                    { key: "reversals", header: "Khấu trừ", render: (m) => currency(m.reversals) },
                    { key: "net", header: "Thực nhận", render: (m) => currency(m.net) },
                    {
                      key: "payoutStatus", header: "Trạng thái",
                      render: (m) => {
                        if (m.payoutStatus === "paid") return <span className="rounded-full bg-[#E6F7F5] dark:bg-[#29B6A1]/20 px-2.5 py-0.5 text-xs font-semibold text-[#1A4739] dark:text-[#29B6A1]">✓ Đã thanh toán</span>;
                        if (m.payoutStatus === "pending") return <span className="rounded-full bg-amber-50 dark:bg-amber-900/20 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400">Chờ xử lý</span>;
                        if (m.payoutStatus === "unrequested") return <span className="text-xs text-gray-500">Chưa yêu cầu</span>;
                        return <span className="text-xs text-gray-400">Đang tích lũy</span>;
                      },
                    },
                  ]}
                />
              )}

              {tab === "conversions" && (
                <DataTable
                  rows={detail.conversions.map((c, i) => ({ ...c, _idx: i + 1 }))}
                  rowKey={(c) => String(c._idx)}
                  empty="Chưa có chuyển đổi"
                  columns={[
                    { key: "_idx", header: "#" },
                    { key: "joinedAt", header: "Ngày đăng ký" },
                    {
                      key: "status", header: "Trạng thái",
                      render: () => <span className="rounded-full bg-[#E6F7F5] dark:bg-[#29B6A1]/20 px-2.5 py-0.5 text-xs font-semibold text-[#1A4739] dark:text-[#29B6A1]">Đang đăng ký</span>,
                    },
                  ]}
                />
              )}

              {tab === "ledger" && (
                <DataTable
                  rows={detail.ledgerEntries}
                  rowKey={(e) => e.id}
                  empty="Sổ cái trống"
                  columns={[
                    { key: "createdAt", header: "Ngày", render: (e) => e.createdAt.slice(0, 10) },
                    {
                      key: "entryType", header: "Loại",
                      render: (e) => {
                        const colors: Record<string, string> = {
                          credit: "text-green-600 dark:text-green-400",
                          reversal: "text-red-600 dark:text-red-400",
                          payout_deduction: "text-gray-500 dark:text-gray-400",
                        };
                        return <span className={colors[e.entryType] ?? "text-gray-600"}>{e.entryType}</span>;
                      },
                    },
                    { key: "amount", header: "Số tiền", render: (e) => currency(e.amount) },
                    { key: "note", header: "Ghi chú", render: (e) => e.note ?? "—" },
                  ]}
                />
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Compile check**

```bash
npx tsc -b --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/pages/admin/AffiliateDetail.tsx
git commit -m "feat: add Admin AffiliateDetail page with 4 tabs"
```

---

## Task 14: `src/pages/admin/PayoutQueue.tsx`

**Files:**
- Create: `src/pages/admin/PayoutQueue.tsx`

- [ ] **Step 1: Create `src/pages/admin/PayoutQueue.tsx`**

```tsx
// src/pages/admin/PayoutQueue.tsx
import { useCallback, useEffect, useState } from "react";
import { useApi } from "../../api";
import { NavBar } from "../../components/NavBar";
import { DataTable } from "../../components/DataTable";
import { currency } from "../../lib/format";
import type { AdminPayoutRequest } from "../../types";

const adminLinks = [
  { to: "/admin", label: "Tổng quan" },
  { to: "/admin/payouts", label: "Thanh toán" },
];

export function PayoutQueue() {
  const api = useApi();
  const [requests, setRequests] = useState<AdminPayoutRequest[]>([]);
  const [error, setError] = useState("");
  const [approving, setApproving] = useState<string | null>(null);
  const [approveNote, setApproveNote] = useState("");
  const [approveLoading, setApproveLoading] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);

  const load = useCallback(() =>
    api.getAdminPayoutRequests()
      .then(setRequests)
      .catch((e) => setError(e instanceof Error ? e.message : "Không thể tải")),
  [api]);

  useEffect(() => { load(); }, [load]);

  const pending = requests.filter((r) => r.status === "pending");
  const completed = requests.filter((r) => r.status === "paid");

  const handleApprove = async (requestId: string) => {
    setApproveLoading(true);
    setApproveError(null);
    try {
      await api.approvePayoutRequest(requestId, approveNote || undefined);
      setApproving(null);
      setApproveNote("");
      await load();
    } catch (e) {
      setApproveError(e instanceof Error ? e.message : "Lỗi không xác định");
    } finally {
      setApproveLoading(false);
    }
  };

  const approvingRequest = approving ? requests.find((r) => r.id === approving) : null;

  return (
    <div>
      <NavBar title="Admin" links={adminLinks} />
      <main className="mx-auto max-w-5xl p-6">
        {error && (
          <p className="mb-4 rounded-xl bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        {/* Pending section */}
        <div className="mb-6 rounded-2xl bg-white dark:bg-[#2D2D2D] p-5 shadow-sm ring-1 ring-black/5 dark:ring-white/10">
          <div className="mb-4 text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#29B6A1" }}>
            Chờ xử lý ({pending.length})
          </div>
          <DataTable
            rows={pending}
            rowKey={(r) => r.id}
            empty="Không có yêu cầu đang chờ"
            columns={[
              { key: "affiliateName", header: "Affiliate" },
              { key: "period", header: "Tháng" },
              { key: "amount", header: "Số tiền", render: (r) => currency(r.amount) },
              { key: "requestedAt", header: "Yêu cầu lúc", render: (r) => r.requestedAt.slice(0, 10) },
              {
                key: "action", header: "",
                render: (r) => (
                  <button
                    onClick={() => { setApproving(r.id); setApproveNote(""); setApproveError(null); }}
                    className="rounded-xl px-3 py-1.5 text-xs font-semibold text-white transition-all hover:opacity-80 active:scale-95"
                    style={{ background: "linear-gradient(135deg, #1A4739 0%, #29B6A1 100%)" }}
                  >
                    Duyệt & Trả
                  </button>
                ),
              },
            ]}
          />
        </div>

        {/* Completed section */}
        <div className="rounded-2xl bg-white dark:bg-[#2D2D2D] p-5 shadow-sm ring-1 ring-black/5 dark:ring-white/10">
          <div className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-gray-400">
            Đã hoàn thành
          </div>
          <DataTable
            rows={completed}
            rowKey={(r) => r.id}
            empty="Chưa có thanh toán nào"
            columns={[
              { key: "affiliateName", header: "Affiliate" },
              { key: "period", header: "Tháng" },
              { key: "amount", header: "Số tiền", render: (r) => currency(r.amount) },
              { key: "completedAt", header: "Ngày trả", render: (r) => r.completedAt?.slice(0, 10) ?? "—" },
              { key: "adminNote", header: "Ghi chú", render: (r) => r.adminNote ?? "—" },
            ]}
          />
        </div>

        {/* Approve modal */}
        {approving && approvingRequest && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#2D2D2D] p-6 shadow-xl ring-1 ring-black/10 dark:ring-white/10">
              <div className="mb-1 text-base font-bold text-gray-900 dark:text-white">Duyệt thanh toán</div>
              <div className="mb-4 text-sm text-gray-500 dark:text-gray-400">
                <span className="font-semibold text-gray-800 dark:text-white">{approvingRequest.affiliateName}</span>
                {" · "}Tháng <span className="font-semibold text-gray-800 dark:text-white">{approvingRequest.period}</span>
                {" · "}<span className="font-semibold text-gray-800 dark:text-white">{currency(approvingRequest.amount)}</span>
              </div>
              <textarea
                value={approveNote}
                onChange={(e) => setApproveNote(e.target.value)}
                placeholder="Ghi chú (tuỳ chọn)"
                rows={2}
                className="mb-3 w-full rounded-xl border border-gray-200 dark:border-white/10 bg-[#F5F5F5] dark:bg-[#1F1F1F] px-3 py-2 text-sm text-gray-700 dark:text-gray-200 focus:border-[#29B6A1] focus:outline-none"
              />
              {approveError && <p className="mb-3 text-xs text-red-500">{approveError}</p>}
              <div className="flex gap-2">
                <button
                  onClick={() => handleApprove(approving)}
                  disabled={approveLoading}
                  className="flex-1 rounded-xl py-2 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg, #1A4739 0%, #29B6A1 100%)" }}
                >
                  {approveLoading ? "Đang xử lý…" : "Xác nhận thanh toán"}
                </button>
                <button
                  onClick={() => setApproving(null)}
                  className="flex-1 rounded-xl border border-gray-200 dark:border-white/10 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5"
                >
                  Huỷ
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

- [ ] **Step 2: Compile check**

```bash
npx tsc -b --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/pages/admin/PayoutQueue.tsx
git commit -m "feat: add Admin PayoutQueue page"
```

---

## Task 15: `src/pages/admin/Overview.tsx` — clickable rows + nav update

**Files:**
- Modify: `src/pages/admin/Overview.tsx`

- [ ] **Step 1: Update `adminLinks` constant**

Change the `adminLinks` array at the top of `Overview.tsx`:

```tsx
const adminLinks = [
  { to: "/admin", label: "Tổng quan" },
  { to: "/admin/payouts", label: "Thanh toán" },
];
```

- [ ] **Step 2: Add `useNavigate` import**

Update the React Router import:

```tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApi } from "../../api";
```

Add inside `Overview` function (after `const api = useApi()`):

```tsx
  const navigate = useNavigate();
```

- [ ] **Step 3: Make rows clickable and remove mark-paid button**

In the `DataTable` columns, remove the entire `action` column object (the one with "Đánh dấu đã trả" button).

Add `onRowClick` prop to `DataTable` (if not supported, add `onClick` via `className` on the row — since `DataTable` may not support `onRowClick`, use a wrapping approach via a custom render on the `name` cell):

Change the `name` column to be a clickable link:

```tsx
                    { key: "name", header: "Tên", render: (r) => (
                      <button
                        onClick={() => navigate(`/admin/affiliates/${r.affiliateId}`)}
                        className="font-medium text-[#29B6A1] hover:underline"
                      >
                        {r.name}
                      </button>
                    )},
```

Remove the `action` column (the "Đánh dấu đã trả" button column).

- [ ] **Step 4: Compile check**

```bash
npx tsc -b --noEmit
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/pages/admin/Overview.tsx
git commit -m "feat: make admin Overview rows clickable, add Payments nav link, remove mark-paid button"
```

---

## Task 16: Routing — `src/App.tsx` + `src/pages/pt/nav.ts`

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/pages/pt/nav.ts`

- [ ] **Step 1: Add "Doanh thu" link to PT nav**

In `src/pages/pt/nav.ts`:

```typescript
export const ptLinks = [
  { to: "/pt", label: "Tổng quan" },
  { to: "/pt/conversions", label: "Doanh thu" },
  { to: "/pt/referral", label: "Mã của tôi" },
  { to: "/pt/bank", label: "Thông tin NH" },
  { to: "/pt/guide", label: "Hướng dẫn" },
];
```

- [ ] **Step 2: Add 3 new routes to `src/App.tsx`**

Add new imports:

```tsx
import { Conversions } from "./pages/pt/Conversions";
import { AffiliateDetail } from "./pages/admin/AffiliateDetail";
import { PayoutQueue } from "./pages/admin/PayoutQueue";
```

Add inside `<Route element={<RequireRole role="pt" />}>`:

```tsx
        <Route path="/pt/conversions" element={<Conversions />} />
```

Add inside `<Route element={<RequireRole role="admin" />}>`:

```tsx
        <Route path="/admin/affiliates/:id" element={<AffiliateDetail />} />
        <Route path="/admin/payouts" element={<PayoutQueue />} />
```

- [ ] **Step 3: Compile check**

```bash
npx tsc -b --noEmit
```

Expected: no errors

- [ ] **Step 4: Run full test suite**

```bash
npm test
```

Expected: all tests pass

- [ ] **Step 5: Final commit**

```bash
git add src/App.tsx src/pages/pt/nav.ts
git commit -m "feat: add routes for Conversions, AffiliateDetail, PayoutQueue pages"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| DB migration — `period` column + unique index | Task 1 |
| `GET /api/affiliate/conversions` | Task 3 |
| `GET /api/affiliate/monthly-earnings` | Task 4 |
| `POST /api/affiliate/payout-request` | Task 5 |
| `GET /api/admin/affiliates/:id` | Task 6 |
| `GET /api/admin/payout-requests` | Task 7 |
| `POST /api/admin/payout-requests/:id/approve` | Task 8 |
| Frontend types | Task 9 |
| neonApi client methods | Task 10 |
| PT Conversions page `/pt/conversions` | Task 11 |
| PT Dashboard monthly earnings + modal | Task 12 |
| Admin AffiliateDetail 4-tab page | Task 13 |
| Admin PayoutQueue page | Task 14 |
| Admin Overview — clickable rows, remove mark-paid | Task 15 |
| Routes + nav links | Task 16 |

**Payout request rules verified:**
- `month >= currentMonth` → 400 (Task 5 step 3)
- `net <= 0` → 400 (Task 5 step 3)
- Duplicate → 409 via `23505` code (Task 5 step 3, test in step 1)

**Type consistency check:** `MonthlyEarning.payoutStatus` values are `"accumulating" | "unrequested" | "pending" | "paid"` consistently across `api/_lib/types.ts` (Task 2), `src/types/index.ts` (Task 9), and rendered in Tasks 12, 13. `AdminPayoutRequest` used consistently in Tasks 7, 8, 9, 10, 14.

**No placeholders:** All steps contain concrete code.
