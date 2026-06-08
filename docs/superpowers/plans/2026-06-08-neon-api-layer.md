# Neon API Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Vercel serverless API routes (`/api/*`) that connect to Neon (PostgreSQL), verify Firebase JWTs, and serve all affiliate data for the portal.

**Architecture:** Each route in `api/` is a Vercel serverless function. Shared helpers in `api/_lib/` handle DB connection (`@neondatabase/serverless`) and Firebase Admin JWT verification. A new `affiliates` table is created via a migration script. Existing Neon tables (`referral_codes`, `referral_wallets`, `referral_conversions`, `payout_requests`) are reused as-is.

**Tech Stack:** `@neondatabase/serverless`, `firebase-admin`, `@vercel/node`, TypeScript, Vitest

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `api/_lib/db.ts` | Create | Neon SQL connection, exported `sql` tag |
| `api/_lib/auth.ts` | Create | Firebase Admin JWT verification |
| `api/_lib/types.ts` | Create | Shared response types for API routes |
| `api/migrate.ts` | Create | One-time migration script (run locally) |
| `api/affiliate/me.ts` | Create | GET profile + referral code, auto-create on first call |
| `api/affiliate/stats.ts` | Create | GET wallet + conversion counts |
| `api/affiliate/payouts.ts` | Create | GET payout history |
| `api/affiliate/bank-info.ts` | Create | GET + POST bank info |
| `api/admin/overview.ts` | Create | GET all affiliates summary (admin only) |
| `api/admin/[id]/mark-paid.ts` | Create | POST mark payouts paid (admin only) |
| `api/_lib/__tests__/auth.test.ts` | Create | Unit tests for auth middleware |
| `api/affiliate/__tests__/me.test.ts` | Create | Unit tests for /affiliate/me |
| `api/affiliate/__tests__/stats.test.ts` | Create | Unit tests for /affiliate/stats |
| `tsconfig.api.json` | Create | TypeScript config for api/ folder |
| `vercel.json` | Modify | Ensure API routes aren't swallowed by SPA catch-all |
| `.env.local` | Modify | Add DATABASE_URL + FIREBASE_SERVICE_ACCOUNT |

---

## Task 1: Install dependencies and configure TypeScript for API

**Files:**
- Modify: `package.json` (via npm)
- Create: `tsconfig.api.json`

- [ ] **Step 1: Install API dependencies**

```bash
cd /Users/truongle/nutree-affiliate
npm install @neondatabase/serverless firebase-admin @vercel/node
```

Expected: packages added, no errors

- [ ] **Step 2: Create `tsconfig.api.json`**

```json
{
  "compilerOptions": {
    "target": "es2022",
    "lib": ["ES2022"],
    "module": "commonjs",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "skipLibCheck": true,
    "outDir": ".vercel/output/functions",
    "types": ["node"]
  },
  "include": ["api/**/*"]
}
```

- [ ] **Step 3: Update `vercel.json` to not swallow API routes**

Replace the entire file with:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "routes": [
    { "handle": "filesystem" },
    { "src": "/(.*)", "dest": "/index.html" }
  ]
}
```

(No change needed — Vercel automatically serves `api/` as functions before the catch-all. Verify by checking that the existing routes don't have `{ "src": "/api/(.*)" }` overriding the filesystem handler.)

- [ ] **Step 4: Add env vars to `.env.local`**

Add these two lines to `.env.local` (the DATABASE_URL you already have, FIREBASE_SERVICE_ACCOUNT from Firebase Console):

```
DATABASE_URL=postgresql://neondb_owner:npg_J0rl7UGaMzNB@ep-round-base-ani0tihw-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"nutree-abf0c",...}
```

To get `FIREBASE_SERVICE_ACCOUNT`: Firebase Console → Project Settings → Service accounts → Generate new private key → download JSON → minify it to one line → paste as the value.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json tsconfig.api.json vercel.json
git commit -m "chore: add api dependencies and tsconfig"
```

---

## Task 2: Run Neon migration — create `affiliates` table

**Files:**
- Create: `api/migrate.ts`

- [ ] **Step 1: Create the migration script**

```typescript
// api/migrate.ts
// Run once locally: npx ts-node --project tsconfig.api.json api/migrate.ts
import { neon } from "@neondatabase/serverless";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);

async function migrate() {
  await sql`
    CREATE TABLE IF NOT EXISTS affiliates (
      id           VARCHAR PRIMARY KEY,
      firebase_uid VARCHAR UNIQUE NOT NULL,
      name         VARCHAR NOT NULL,
      email        VARCHAR NOT NULL,
      role         VARCHAR NOT NULL DEFAULT 'pt',
      bank_info    JSON,
      created_at   TIMESTAMPTZ DEFAULT NOW(),
      updated_at   TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  console.log("✓ affiliates table created");
}

migrate().catch((err) => { console.error(err); process.exit(1); });
```

- [ ] **Step 2: Install ts-node for running the migration**

```bash
npm install -D ts-node dotenv
```

- [ ] **Step 3: Run the migration**

```bash
npx ts-node --project tsconfig.api.json api/migrate.ts
```

Expected output:
```
✓ affiliates table created
```

- [ ] **Step 4: Verify in Neon console**

Go to Neon Console → SQL Editor → run:
```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'affiliates' ORDER BY ordinal_position;
```

Expected: 8 columns — id, firebase_uid, name, email, role, bank_info, created_at, updated_at

- [ ] **Step 5: Commit**

```bash
git add api/migrate.ts package.json package-lock.json
git commit -m "chore: add affiliates table migration"
```

---

## Task 3: Create `api/_lib/db.ts` — Neon connection

**Files:**
- Create: `api/_lib/db.ts`

- [ ] **Step 1: Create the file**

```typescript
// api/_lib/db.ts
import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set");
}

export const sql = neon(process.env.DATABASE_URL);
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --project tsconfig.api.json --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add api/_lib/db.ts
git commit -m "feat: add neon db connection"
```

---

## Task 4: Create `api/_lib/auth.ts` — Firebase Admin JWT verification

**Files:**
- Create: `api/_lib/auth.ts`
- Create: `api/_lib/__tests__/auth.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// api/_lib/__tests__/auth.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("firebase-admin", () => ({
  default: {
    apps: [],
    initializeApp: vi.fn(),
    credential: { cert: vi.fn((sa) => sa) },
    auth: vi.fn(() => ({
      verifyIdToken: vi.fn(),
    })),
  },
}));

// Import after mock
const getAdmin = () => import("firebase-admin").then((m) => m.default);

describe("verifyAuth", () => {
  beforeEach(() => {
    process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify({
      type: "service_account",
      project_id: "test",
    });
    vi.resetModules();
  });

  it("throws 401 when Authorization header is missing", async () => {
    const { verifyAuth } = await import("../auth");
    const req = { headers: {} } as never;
    await expect(verifyAuth(req)).rejects.toMatchObject({ status: 401 });
  });

  it("throws 401 when token is invalid", async () => {
    const admin = await getAdmin();
    (admin.auth().verifyIdToken as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("invalid token")
    );
    const { verifyAuth } = await import("../auth");
    const req = { headers: { authorization: "Bearer bad-token" } } as never;
    await expect(verifyAuth(req)).rejects.toMatchObject({ status: 401 });
  });

  it("returns uid, name, email on valid token", async () => {
    const admin = await getAdmin();
    (admin.auth().verifyIdToken as ReturnType<typeof vi.fn>).mockResolvedValue({
      uid: "firebase-uid-123",
      name: "Alex",
      email: "alex@test.com",
    });
    const { verifyAuth } = await import("../auth");
    const req = {
      headers: { authorization: "Bearer valid-token" },
    } as never;
    const result = await verifyAuth(req);
    expect(result).toEqual({
      uid: "firebase-uid-123",
      name: "Alex",
      email: "alex@test.com",
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --run api/_lib/__tests__/auth.test.ts
```

Expected: FAIL — `verifyAuth` not found

- [ ] **Step 3: Create `api/_lib/auth.ts`**

```typescript
// api/_lib/auth.ts
import type { VercelRequest } from "@vercel/node";
import admin from "firebase-admin";

function initAdmin() {
  if (admin.apps.length > 0) return;
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT!);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

export interface AuthUser {
  uid: string;
  name: string;
  email: string;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function verifyAuth(req: VercelRequest): Promise<AuthUser> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    throw new ApiError(401, "Missing or invalid Authorization header");
  }
  const token = authHeader.slice(7);
  try {
    initAdmin();
    const decoded = await admin.auth().verifyIdToken(token);
    return {
      uid: decoded.uid,
      name: (decoded.name as string) ?? decoded.email ?? "Affiliate",
      email: (decoded.email as string) ?? "",
    };
  } catch {
    throw new ApiError(401, "Invalid or expired token");
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- --run api/_lib/__tests__/auth.test.ts
```

Expected: 3/3 pass

- [ ] **Step 5: Commit**

```bash
git add api/_lib/auth.ts api/_lib/__tests__/auth.test.ts
git commit -m "feat: add firebase admin jwt verification"
```

---

## Task 5: Create `api/_lib/types.ts` — shared response types

**Files:**
- Create: `api/_lib/types.ts`

- [ ] **Step 1: Create the file**

```typescript
// api/_lib/types.ts

export interface AffiliateProfile {
  affiliateId: string;
  name: string;
  email: string;
  role: string;
  referralCode: string;
  referralLink: string;
}

export interface AffiliateStats {
  balance: number;
  totalEarned: number;
  totalWithdrawn: number;
  pendingTrials: number;
  activeSubscriptions: number;
}

export interface PayoutRequest {
  id: string;
  amount: number;
  status: string;
  paymentMethod: string | null;
  paymentDetails: Record<string, string> | null;
  requestedAt: string;
  completedAt: string | null;
  adminNote: string | null;
}

export interface BankInfo {
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  routingOrSwift?: string;
}

export interface AdminAffiliateRow {
  affiliateId: string;
  name: string;
  code: string;
  pendingTrials: number;
  activeSubscriptions: number;
  totalEarned: number;
  balance: number;
  hasBankInfo: boolean;
  lastPaidDate: string | null;
}

export interface AdminOverview {
  totalRevenue: number;
  totalPayoutOwed: number;
  activeAffiliates: number;
  commissionPerConversion: number;
  affiliates: AdminAffiliateRow[];
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --project tsconfig.api.json --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add api/_lib/types.ts
git commit -m "feat: add shared api response types"
```

---

## Task 6: Create `api/affiliate/me.ts` — profile + auto-create

**Files:**
- Create: `api/affiliate/me.ts`
- Create: `api/affiliate/__tests__/me.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// api/affiliate/__tests__/me.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

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
  const res = { statusCode: 200, body: "" as unknown };
  res.status = vi.fn((code: number) => { res.statusCode = code; return res; });
  res.json = vi.fn((data: unknown) => { res.body = data; return res; });
  return res;
}

describe("GET /api/affiliate/me", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyAuth.mockResolvedValue({
      uid: "firebase-uid-1",
      name: "Alex",
      email: "alex@test.com",
    });
  });

  it("returns 401 if auth fails", async () => {
    const { ApiError } = await import("../../_lib/auth");
    mockVerifyAuth.mockRejectedValue(new ApiError(401, "Unauthorized"));
    const handler = (await import("../me")).default;
    const req = { headers: {}, method: "GET" } as never;
    const res = makeRes();
    await handler(req, res as never);
    expect(res.statusCode).toBe(401);
  });

  it("returns existing affiliate profile", async () => {
    mockSql
      .mockResolvedValueOnce([{
        id: "aff-1", firebase_uid: "firebase-uid-1",
        name: "Alex", email: "alex@test.com", role: "pt",
        bank_info: null, created_at: new Date(),
      }])
      .mockResolvedValueOnce([{ code: "ABCD1234" }]);

    const handler = (await import("../me")).default;
    const req = { headers: { authorization: "Bearer tok" }, method: "GET" } as never;
    const res = makeRes();
    await handler(req, res as never);
    expect(res.statusCode).toBe(200);
    expect((res.body as { referralCode: string }).referralCode).toBe("ABCD1234");
  });

  it("creates new affiliate on first login", async () => {
    mockSql
      .mockResolvedValueOnce([])          // affiliate not found
      .mockResolvedValueOnce([])          // begin transaction (ignored)
      .mockResolvedValueOnce([{ id: "new-aff-id", firebase_uid: "firebase-uid-1", name: "Alex", email: "alex@test.com", role: "pt", bank_info: null }])
      .mockResolvedValueOnce([{ code: "NEWAFF12" }])
      .mockResolvedValueOnce([]);         // wallet insert

    const handler = (await import("../me")).default;
    const req = { headers: { authorization: "Bearer tok" }, method: "GET" } as never;
    const res = makeRes();
    await handler(req, res as never);
    expect(res.statusCode).toBe(200);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --run api/affiliate/__tests__/me.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 3: Create `api/affiliate/me.ts`**

```typescript
// api/affiliate/me.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql } from "../_lib/db";
import { verifyAuth, ApiError } from "../_lib/auth";
import type { AffiliateProfile } from "../_lib/types";
import { randomUUID } from "crypto";

function generateReferralCode(affiliateId: string): string {
  return affiliateId.replace(/-/g, "").slice(0, 8).toUpperCase();
}

async function getOrCreateAffiliate(
  uid: string,
  name: string,
  email: string
): Promise<{ affiliate: { id: string; role: string }; code: string }> {
  // Check existing
  const existing = await sql`
    SELECT id, role FROM affiliates WHERE firebase_uid = ${uid}
  `;
  if (existing.length > 0) {
    const affiliate = existing[0] as { id: string; role: string };
    const codes = await sql`
      SELECT code FROM referral_codes WHERE user_id = ${affiliate.id}
    `;
    const code = (codes[0] as { code: string })?.code ?? "";
    return { affiliate, code };
  }

  // Create new affiliate in a transaction
  const affiliateId = randomUUID();
  const code = generateReferralCode(affiliateId);

  await sql`
    INSERT INTO affiliates (id, firebase_uid, name, email, role)
    VALUES (${affiliateId}, ${uid}, ${name}, ${email}, 'pt')
  `;
  await sql`
    INSERT INTO referral_codes (user_id, code, created_at)
    VALUES (${affiliateId}, ${code}, NOW())
  `;
  await sql`
    INSERT INTO referral_wallets (user_id, balance, total_earned, total_revoked, total_withdrawn, updated_at)
    VALUES (${affiliateId}, 0, 0, 0, 0, NOW())
  `;

  return { affiliate: { id: affiliateId, role: "pt" }, code };
}

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
    const rows = await sql`
      SELECT id, name, email, role FROM affiliates WHERE firebase_uid = ${user.uid}
    `;

    let affiliateId: string;
    let role: string;
    let code: string;

    if (rows.length === 0) {
      const created = await getOrCreateAffiliate(user.uid, user.name, user.email);
      affiliateId = created.affiliate.id;
      role = created.affiliate.role;
      code = created.code;
    } else {
      const aff = rows[0] as { id: string; role: string };
      affiliateId = aff.id;
      role = aff.role;
      const codes = await sql`SELECT code FROM referral_codes WHERE user_id = ${affiliateId}`;
      code = (codes[0] as { code: string })?.code ?? "";
    }

    const nameRow = await sql`SELECT name, email FROM affiliates WHERE id = ${affiliateId}`;
    const aff = nameRow[0] as { name: string; email: string };

    const profile: AffiliateProfile = {
      affiliateId,
      name: aff.name,
      email: aff.email,
      role,
      referralCode: code,
      referralLink: `https://nutree.app/r/${code}`,
    };

    res.status(200).json(profile);
  } catch (err) {
    if (err instanceof ApiError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error("/api/affiliate/me error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- --run api/affiliate/__tests__/me.test.ts
```

Expected: 3/3 pass

- [ ] **Step 5: Commit**

```bash
git add api/affiliate/me.ts api/affiliate/__tests__/me.test.ts
git commit -m "feat: add GET /api/affiliate/me with auto-create"
```

---

## Task 7: Create `api/affiliate/stats.ts`

**Files:**
- Create: `api/affiliate/stats.ts`
- Create: `api/affiliate/__tests__/stats.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// api/affiliate/__tests__/stats.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

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
  const res = { statusCode: 200, body: "" as unknown };
  res.status = vi.fn((c: number) => { res.statusCode = c; return res; });
  res.json = vi.fn((d: unknown) => { res.body = d; return res; });
  return res;
}

describe("GET /api/affiliate/stats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyAuth.mockResolvedValue({ uid: "fb-uid", name: "Alex", email: "a@test.com" });
  });

  it("returns 404 if affiliate not found", async () => {
    mockSql.mockResolvedValueOnce([]);
    const handler = (await import("../stats")).default;
    const req = { headers: { authorization: "Bearer tok" }, method: "GET" } as never;
    const res = makeRes();
    await handler(req, res as never);
    expect(res.statusCode).toBe(404);
  });

  it("returns stats with wallet and conversion counts", async () => {
    mockSql
      .mockResolvedValueOnce([{ id: "aff-1" }]) // affiliate lookup
      .mockResolvedValueOnce([{ balance: 600000, total_earned: 900000, total_withdrawn: 300000 }]) // wallet
      .mockResolvedValueOnce([
        { status: "trial", count: "2" },
        { status: "active", count: "3" },
      ]); // conversions

    const handler = (await import("../stats")).default;
    const req = { headers: { authorization: "Bearer tok" }, method: "GET" } as never;
    const res = makeRes();
    await handler(req, res as never);
    expect(res.statusCode).toBe(200);
    const body = res.body as { balance: number; pendingTrials: number; activeSubscriptions: number };
    expect(body.balance).toBe(600000);
    expect(body.pendingTrials).toBe(2);
    expect(body.activeSubscriptions).toBe(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --run api/affiliate/__tests__/stats.test.ts
```

Expected: FAIL

- [ ] **Step 3: Create `api/affiliate/stats.ts`**

```typescript
// api/affiliate/stats.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql } from "../_lib/db";
import { verifyAuth, ApiError } from "../_lib/auth";
import type { AffiliateStats } from "../_lib/types";

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
      SELECT id FROM affiliates WHERE firebase_uid = ${user.uid}
    `;
    if (affiliates.length === 0) {
      res.status(404).json({ error: "Affiliate not found" });
      return;
    }
    const affiliateId = (affiliates[0] as { id: string }).id;

    const [wallets, conversions] = await Promise.all([
      sql`SELECT balance, total_earned, total_withdrawn FROM referral_wallets WHERE user_id = ${affiliateId}`,
      sql`
        SELECT status, COUNT(*) as count
        FROM referral_conversions
        WHERE referrer_user_id = ${affiliateId}
        GROUP BY status
      `,
    ]);

    const wallet = (wallets[0] as { balance: number; total_earned: number; total_withdrawn: number }) ?? {
      balance: 0, total_earned: 0, total_withdrawn: 0,
    };

    const convMap = new Map<string, number>();
    for (const row of conversions as { status: string; count: string }[]) {
      convMap.set(row.status, parseInt(row.count, 10));
    }

    const stats: AffiliateStats = {
      balance: wallet.balance,
      totalEarned: wallet.total_earned,
      totalWithdrawn: wallet.total_withdrawn,
      pendingTrials: convMap.get("trial") ?? 0,
      activeSubscriptions: convMap.get("active") ?? 0,
    };

    res.status(200).json(stats);
  } catch (err) {
    if (err instanceof ApiError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error("/api/affiliate/stats error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- --run api/affiliate/__tests__/stats.test.ts
```

Expected: 2/2 pass

- [ ] **Step 5: Commit**

```bash
git add api/affiliate/stats.ts api/affiliate/__tests__/stats.test.ts
git commit -m "feat: add GET /api/affiliate/stats"
```

---

## Task 8: Create `api/affiliate/payouts.ts`

**Files:**
- Create: `api/affiliate/payouts.ts`

- [ ] **Step 1: Create the file**

```typescript
// api/affiliate/payouts.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql } from "../_lib/db";
import { verifyAuth, ApiError } from "../_lib/auth";
import type { PayoutRequest } from "../_lib/types";

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
      SELECT id FROM affiliates WHERE firebase_uid = ${user.uid}
    `;
    if (affiliates.length === 0) {
      res.status(404).json({ error: "Affiliate not found" });
      return;
    }
    const affiliateId = (affiliates[0] as { id: string }).id;

    const rows = await sql`
      SELECT id, amount, status, payment_method, payment_details,
             requested_at, completed_at, admin_note
      FROM payout_requests
      WHERE user_id = ${affiliateId}
      ORDER BY requested_at DESC
    `;

    const payouts: PayoutRequest[] = (rows as {
      id: string;
      amount: number;
      status: string;
      payment_method: string | null;
      payment_details: Record<string, string> | null;
      requested_at: Date;
      completed_at: Date | null;
      admin_note: string | null;
    }[]).map((r) => ({
      id: r.id,
      amount: r.amount,
      status: r.status,
      paymentMethod: r.payment_method,
      paymentDetails: r.payment_details,
      requestedAt: r.requested_at.toISOString(),
      completedAt: r.completed_at?.toISOString() ?? null,
      adminNote: r.admin_note,
    }));

    res.status(200).json(payouts);
  } catch (err) {
    if (err instanceof ApiError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error("/api/affiliate/payouts error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --project tsconfig.api.json --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add api/affiliate/payouts.ts
git commit -m "feat: add GET /api/affiliate/payouts"
```

---

## Task 9: Create `api/affiliate/bank-info.ts`

**Files:**
- Create: `api/affiliate/bank-info.ts`

- [ ] **Step 1: Create the file**

```typescript
// api/affiliate/bank-info.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql } from "../_lib/db";
import { verifyAuth, ApiError } from "../_lib/auth";
import type { BankInfo } from "../_lib/types";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (req.method !== "GET" && req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  try {
    const user = await verifyAuth(req);

    const affiliates = await sql`
      SELECT id FROM affiliates WHERE firebase_uid = ${user.uid}
    `;
    if (affiliates.length === 0) {
      res.status(404).json({ error: "Affiliate not found" });
      return;
    }
    const affiliateId = (affiliates[0] as { id: string }).id;

    if (req.method === "GET") {
      const rows = await sql`
        SELECT bank_info FROM affiliates WHERE id = ${affiliateId}
      `;
      const bankInfo = (rows[0] as { bank_info: BankInfo | null }).bank_info;
      res.status(200).json(bankInfo);
      return;
    }

    // POST — save bank info
    const body = req.body as BankInfo;
    if (!body?.bankName || !body?.accountHolder || !body?.accountNumber) {
      res.status(400).json({ error: "bankName, accountHolder, and accountNumber are required" });
      return;
    }
    const bankInfo: BankInfo = {
      bankName: body.bankName,
      accountHolder: body.accountHolder,
      accountNumber: body.accountNumber,
      ...(body.routingOrSwift ? { routingOrSwift: body.routingOrSwift } : {}),
    };
    await sql`
      UPDATE affiliates
      SET bank_info = ${JSON.stringify(bankInfo)}, updated_at = NOW()
      WHERE id = ${affiliateId}
    `;
    res.status(200).json(bankInfo);
  } catch (err) {
    if (err instanceof ApiError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error("/api/affiliate/bank-info error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --project tsconfig.api.json --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add api/affiliate/bank-info.ts
git commit -m "feat: add GET+POST /api/affiliate/bank-info"
```

---

## Task 10: Create `api/admin/overview.ts`

**Files:**
- Create: `api/admin/overview.ts`

- [ ] **Step 1: Create the file**

```typescript
// api/admin/overview.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql } from "../_lib/db";
import { verifyAuth, ApiError } from "../_lib/auth";
import type { AdminOverview, AdminAffiliateRow } from "../_lib/types";

const COMMISSION_PER_CONVERSION = 300_000; // VND

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

    // Check admin role
    const affiliates = await sql`
      SELECT id, role FROM affiliates WHERE firebase_uid = ${user.uid}
    `;
    if (affiliates.length === 0 || (affiliates[0] as { role: string }).role !== "admin") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    // Get all affiliates with their referral codes and wallets
    const allAffiliates = await sql`
      SELECT a.id, a.name, a.bank_info,
             rc.code,
             rw.balance, rw.total_earned
      FROM affiliates a
      LEFT JOIN referral_codes rc ON rc.user_id = a.id
      LEFT JOIN referral_wallets rw ON rw.user_id = a.id
      WHERE a.role = 'pt'
    `;

    // Get conversion counts per affiliate
    const conversionCounts = await sql`
      SELECT referrer_user_id, status, COUNT(*) as count
      FROM referral_conversions
      GROUP BY referrer_user_id, status
    `;

    // Get last paid date per affiliate
    const lastPaid = await sql`
      SELECT user_id, MAX(completed_at) as last_paid_date
      FROM payout_requests
      WHERE status = 'paid'
      GROUP BY user_id
    `;

    const lastPaidMap = new Map<string, string>();
    for (const row of lastPaid as { user_id: string; last_paid_date: Date | null }[]) {
      if (row.last_paid_date) {
        lastPaidMap.set(row.user_id, row.last_paid_date.toISOString().slice(0, 10));
      }
    }

    const convMap = new Map<string, Map<string, number>>();
    for (const row of conversionCounts as { referrer_user_id: string; status: string; count: string }[]) {
      if (!convMap.has(row.referrer_user_id)) convMap.set(row.referrer_user_id, new Map());
      convMap.get(row.referrer_user_id)!.set(row.status, parseInt(row.count, 10));
    }

    const rows: AdminAffiliateRow[] = (allAffiliates as {
      id: string; name: string; bank_info: unknown;
      code: string | null; balance: number | null; total_earned: number | null;
    }[]).map((a) => {
      const convs = convMap.get(a.id) ?? new Map();
      return {
        affiliateId: a.id,
        name: a.name,
        code: a.code ?? "",
        pendingTrials: convs.get("trial") ?? 0,
        activeSubscriptions: convs.get("active") ?? 0,
        totalEarned: a.total_earned ?? 0,
        balance: a.balance ?? 0,
        hasBankInfo: !!a.bank_info,
        lastPaidDate: lastPaidMap.get(a.id) ?? null,
      };
    });

    const overview: AdminOverview = {
      totalRevenue: rows.reduce((s, r) => s + r.totalEarned, 0),
      totalPayoutOwed: rows.reduce((s, r) => s + r.balance, 0),
      activeAffiliates: rows.length,
      commissionPerConversion: COMMISSION_PER_CONVERSION,
      affiliates: rows,
    };

    res.status(200).json(overview);
  } catch (err) {
    if (err instanceof ApiError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error("/api/admin/overview error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --project tsconfig.api.json --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add api/admin/overview.ts
git commit -m "feat: add GET /api/admin/overview"
```

---

## Task 11: Create `api/admin/[id]/mark-paid.ts`

**Files:**
- Create: `api/admin/[id]/mark-paid.ts`

- [ ] **Step 1: Create the directory and file**

```bash
mkdir -p /Users/truongle/nutree-affiliate/api/admin/\[id\]
```

```typescript
// api/admin/[id]/mark-paid.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql } from "../../_lib/db";
import { verifyAuth, ApiError } from "../../_lib/auth";

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

    // Check admin role
    const callers = await sql`
      SELECT role FROM affiliates WHERE firebase_uid = ${user.uid}
    `;
    if (callers.length === 0 || (callers[0] as { role: string }).role !== "admin") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const affiliateId = req.query.id as string;
    if (!affiliateId) {
      res.status(400).json({ error: "Missing affiliate id" });
      return;
    }

    // Verify the target affiliate exists
    const target = await sql`SELECT id FROM affiliates WHERE id = ${affiliateId}`;
    if (target.length === 0) {
      res.status(404).json({ error: "Affiliate not found" });
      return;
    }

    await sql`
      UPDATE payout_requests
      SET status = 'paid', completed_at = NOW(), updated_at = NOW()
      WHERE user_id = ${affiliateId} AND status = 'pending'
    `;

    res.status(200).json({ ok: true });
  } catch (err) {
    if (err instanceof ApiError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error("/api/admin/[id]/mark-paid error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --project tsconfig.api.json --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add "api/admin/[id]/mark-paid.ts"
git commit -m "feat: add POST /api/admin/[id]/mark-paid"
```

---

## Task 12: Run full test suite and push

- [ ] **Step 1: Run all tests**

```bash
npm test -- --run
```

Expected: all tests pass (existing 26 + new auth + me + stats tests)

- [ ] **Step 2: Add `DATABASE_URL` and `FIREBASE_SERVICE_ACCOUNT` to Vercel**

```bash
npx vercel env add DATABASE_URL production <<< "postgresql://neondb_owner:npg_J0rl7UGaMzNB@ep-round-base-ani0tihw-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require"
```

For `FIREBASE_SERVICE_ACCOUNT`: go to Firebase Console → Project Settings → Service accounts → Generate new private key → download JSON → minify with:

```bash
cat path/to/service-account.json | python3 -c "import sys,json; print(json.dumps(json.load(sys.stdin)))"
```

Then add via Vercel CLI:
```bash
echo 'YOUR_MINIFIED_JSON' | npx vercel env add FIREBASE_SERVICE_ACCOUNT production
```

- [ ] **Step 3: Deploy to production**

```bash
npx vercel --prod --yes
```

Expected: deployment URL printed, status READY

- [ ] **Step 4: Smoke test the deployed API**

```bash
# Should return 401 (no token)
curl -s https://nutree-affiliate.vercel.app/api/affiliate/me | jq .
```

Expected: `{"error":"Missing or invalid Authorization header"}`

- [ ] **Step 5: Push to git**

```bash
git push origin main
```
