# Affiliate Payout Business Rules Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enforce a 15-day holding period per conversion before commission becomes payable, block payout requests while any conversion in the requested month is still locked, and auto-deduct post-payout refund carry-over from the next payout amount.

**Architecture:** No new tables. Two new columns on `affiliate_conversions` (`occurred_at`, `locked_until`). Credits are still written to the ledger immediately (event-sourced). Holding period is a property of the conversion row; all downstream logic reads `locked_until` at query time.

**Tech Stack:** Neon Postgres (SQL), Vercel serverless TypeScript handlers, React 19 + Tailwind CSS frontend.

---

## 1. Schema Changes

### `affiliate_conversions`

```sql
ALTER TABLE affiliate_conversions
  ADD COLUMN IF NOT EXISTS occurred_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;
```

- `occurred_at`: the purchase timestamp from the MealTrack event envelope (`evt.occurred_at`). Set on both `subscription_initial_purchase` (conversion) and `affiliate_attribution_created` (trial, for traceability).
- `locked_until`: `occurred_at + INTERVAL '15 days'`. Stored explicitly (not a generated column) so it is indexable and queryable without arithmetic.
- Both columns are nullable to remain backward-compatible with existing rows (pre-rule conversions are treated as already unlocked: `locked_until IS NULL` → cleared).

No changes to `affiliate_ledger_entries`. The ledger remains a pure financial record.

---

## 2. Event Handler Changes (`api/internal/mealtrack-events.ts`)

### `EventEnvelope` interface

`occurred_at` is already in the interface (unused). No change needed.

### `affiliate_attribution_created`

```sql
INSERT INTO affiliate_conversions
  (affiliate_id, user_id, affiliate_code_id, event_id, status, occurred_at, locked_until)
VALUES (...)
ON CONFLICT (user_id) DO NOTHING
```

Store `occurred_at` and `locked_until = occurred_at + INTERVAL '15 days'` on the trial row.

### `subscription_initial_purchase`

In the TypeScript handler, resolve the effective timestamp before running SQL:

```typescript
// Fall back to NOW() if MealTrack omits occurred_at; log a warning so it's visible.
const effectiveOccurredAt = evt.occurred_at ?? new Date().toISOString();
if (!evt.occurred_at) {
  console.warn("subscription_initial_purchase missing occurred_at, using NOW()", evt.event_id);
}
```

When updating the trial to `converted`:

```sql
UPDATE affiliate_conversions
SET status = 'converted', converted_at = NOW(),
    occurred_at = ${effectiveOccurredAt},
    locked_until = ${effectiveOccurredAt}::timestamptz + INTERVAL '15 days'
WHERE id = ${trial.id}
```

When inserting directly as `converted` (no prior trial):

```sql
INSERT INTO affiliate_conversions
  (..., occurred_at, locked_until)
VALUES (..., ${effectiveOccurredAt}, ${effectiveOccurredAt}::timestamptz + INTERVAL '15 days')
```

Credit ledger entry is still created immediately — no change to `insertLedgerEntry`.

---

## 3. Monthly Earnings Logic

### New `payoutStatus` state: `locked`

Full precedence order for a past month:

```
accumulating (current/future month)
  ↓
locked (any conversion in month has locked_until > NOW())
  ↓
paid (payout request exists, status = 'paid')
  ↓
pending (payout request exists, status = 'pending')
  ↓
unrequested (net > 0, no payout request)
  ↓
accumulating (net = 0, nothing to request)
```

### Query changes (`api/affiliate/monthly-earnings.ts` and `api/admin/affiliates/[id].ts`)

Two separate queries (merged in application code by month key). Avoids matching on month strings between two timestamps that could differ if a webhook arrives across a month boundary.

**Query 1 — ledger aggregation (unchanged):**

```sql
SELECT
  TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month,
  COALESCE(SUM(CASE WHEN entry_type = 'credit' THEN amount ELSE 0 END), 0) AS credits,
  COALESCE(SUM(CASE WHEN entry_type = 'reversal' THEN amount ELSE 0 END), 0) AS reversals
FROM affiliate_ledger_entries
WHERE affiliate_id = ${affiliateId}
GROUP BY DATE_TRUNC('month', created_at)
ORDER BY DATE_TRUNC('month', created_at) DESC
```

**Query 2 — locked_until per ledger month (new):**

Join via `le.reference_id = ac.event_id` — the exact correspondence written by `insertLedgerEntry`. This avoids relying on timestamp proximity and survives delayed webhook delivery.

```sql
SELECT
  TO_CHAR(DATE_TRUNC('month', le.created_at), 'YYYY-MM') AS month,
  MAX(ac.locked_until) AS latest_locked_until
FROM affiliate_ledger_entries le
JOIN affiliate_conversions ac ON ac.event_id = le.reference_id
WHERE le.affiliate_id = ${affiliateId}
  AND le.entry_type = 'credit'
  AND ac.locked_until IS NOT NULL
GROUP BY DATE_TRUNC('month', le.created_at)
```

Merge the two result sets in TypeScript by `month` key before computing `payoutStatus`.

### `MonthlyEarning` type

Add one field:

```typescript
lockedUntil: string | null  // ISO date string of MAX(locked_until) for the month, null if all cleared
```

Existing fields unchanged.

---

## 4. Payout Request Validation & Amount

### Validation order (`api/affiliate/payout-request.ts`)

1. Method guard (existing)
2. Auth + affiliate lookup (existing)
3. `month < currentMonth` format check (existing)
4. No existing payout for that month (existing)
5. **NEW**: Check no credits in the requested month have a source conversion still locked.
   Uses the same `reference_id = event_id` join as the monthly-earnings query — avoids month-string matching between `occurred_at` and `created_at` which can differ when webhooks are delayed:
   ```sql
   SELECT MAX(ac.locked_until) AS latest_locked
   FROM affiliate_ledger_entries le
   JOIN affiliate_conversions ac ON ac.event_id = le.reference_id
   WHERE le.affiliate_id = ${affiliateId}
     AND le.entry_type = 'credit'
     AND TO_CHAR(DATE_TRUNC('month', le.created_at), 'YYYY-MM') = ${month}
     AND ac.locked_until > NOW()
   ```
   If result is non-null → `422 { error: "Tháng này chưa hết thời gian giữ tiền", lockedUntil: "<ISO date>" }`

6. **NEW**: Compute carry-over-aware payout amount:
   ```
   net_M        = credits_M − reversals_M   (for the requested month only)
   overall_bal  = Σcredits − Σreversals − Σpayout_deductions  (all time)
   payout_amount = max(0, min(net_M, overall_bal))
   ```
   If `payout_amount <= 0` → `422 { error: "Hoa hồng tháng này chưa đủ bù khoản hoàn tiền trước đó." }`

7. Insert payout row with computed `payout_amount` (existing insert pattern, just changed amount source)

No changes to admin approve flow — ledger deduction still happens at approval time, unchanged.

---

## 5. UI Changes

### `MonthlyEarning` status display (`src/pages/pt/Earnings.tsx`)

| `payoutStatus` | Display |
|---|---|
| `accumulating` | "Đang tích lũy" (grey text) |
| `locked` | 🔒 amber badge: "Mở khoá vào DD/MM/YYYY" |
| `unrequested` | "Yêu cầu thanh toán" green button |
| `pending` | "Chờ xử lý" amber badge |
| `paid` | "✓ Đã thanh toán" green badge |

`lockedUntil` from `MonthlyEarning` is formatted as a short date (e.g. `26/07/2026`) using existing `dateOrDash` helper or `new Date(lockedUntil).toLocaleDateString('vi-VN')`.

### `AffiliateDetail.tsx` admin — Thu nhập tab

Same locked badge display so admin can see which months are awaiting unlock.

---

## 6. Migration

Run as part of `api/migrate.ts` (safe to re-run):

```sql
ALTER TABLE affiliate_conversions
  ADD COLUMN IF NOT EXISTS occurred_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;
```

Existing rows get `NULL` for both columns. `NULL locked_until` is treated as "already cleared" everywhere (no `IS NOT NULL` guard needed — `MAX(locked_until)` over all-NULL returns NULL, which correctly means "not locked").

---

## 7. Testing

### Unit tests to add

- `readRawBody` (existing) — no change
- `monthly-earnings`: month with all conversions cleared → `unrequested`; month with one locked conversion → `locked` with correct `lockedUntil`
- `payout-request`: locked month returns 422 with `lockedUntil`; carry-over debt reduces amount; debt > earnings returns 0-amount rejection
- `mealtrack-events`: `subscription_initial_purchase` sets `occurred_at` and `locked_until` on conversion

### Manual smoke test sequence

1. Send `affiliate_attribution_created` → conversion status `trial`
2. Send `subscription_initial_purchase` with `occurred_at = NOW()` → conversion status `converted`, `locked_until = NOW() + 15d`, credit in ledger
3. GET `/api/affiliate/monthly-earnings` → current month `accumulating`; past month (if seeded with backdated `occurred_at`) shows `locked` or `unrequested` depending on date
4. Attempt payout request for locked month → 422 with `lockedUntil`
5. Seed a conversion with `occurred_at = 14 days ago, locked_until = yesterday` → month becomes `unrequested`
6. Submit payout request → succeeds with correct carry-over-aware amount

---

## Edge Cases

- **Refund during holding period**: `subscription_refund` event creates a `reversal` entry and marks conversion as `refunded`. `net_M` drops to 0. Month may still show `locked` until the holding window expires, then becomes `accumulating` (zero net). Expected behavior.
- **`occurred_at` missing from event**: MealTrack should always send it, but if null/absent, fall back to `NOW()` — holding period clock starts on receipt. Logged as a warning.
- **Multiple conversions, one refunded in holding period**: The refunded conversion still has a `locked_until` that counts toward the month's lock. After holding clears, net = 0 for that conversion (reversal already written). Net_M is correctly reduced.
- **Negative overall balance larger than any single month's earnings**: `payout_amount = 0`, request rejected. Affiliate must accumulate enough credits in future months to cover the debt before any payout is possible.
