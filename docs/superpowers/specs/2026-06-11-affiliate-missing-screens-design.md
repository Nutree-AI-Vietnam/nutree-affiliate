# Affiliate Portal — Missing Screens Design

**Date:** 2026-06-11  
**Status:** Approved  
**Scope:** 2 new PT screens, 2 new Admin screens, extensions to existing Dashboard and Overview

---

## 1. Problem

The affiliate portal is missing:
- Admin cannot see an affiliate's bank account details or full earnings history
- PT affiliates cannot see which users have subscribed via their code
- No payout request workflow — admin had to initiate payment; affiliates have no way to request
- No per-month earnings breakdown for either side

---

## 2. Screen Inventory

| Route | Type | Audience |
|---|---|---|
| `/pt` Dashboard | extend | PT affiliate |
| `/pt/conversions` | new | PT affiliate |
| `/admin` Overview | extend (clickable rows) | Admin |
| `/admin/affiliates/:id` | new | Admin |
| `/admin/payouts` | new | Admin |

---

## 3. Payout Request Flow

Monthly cadence, affiliate-initiated:

1. Affiliate earns ledger credits during month X
2. After month X ends, "Yêu cầu thanh toán" button appears for that month on Dashboard
3. Affiliate confirms → `POST /api/affiliate/payout-request { month: "2026-06" }`
4. Payout request created with `status = "pending"`
5. Request appears in `/admin/payouts` queue
6. Admin clicks "Duyệt & Trả", adds optional note → `POST /api/admin/payout-requests/:id/approve`
7. Ledger `payout_deduction` entry written, payout status → `"paid"`

**Rules:**
- One request per affiliate per month (unique constraint on `affiliate_id + period`)
- Can only request for months where `month < current UTC calendar month` (strictly past) and per-month net > 0
- Current in-progress calendar month cannot be requested
- Admin can only pay requests that exist — no admin-initiated payouts

---

## 4. API Surface

### New endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/affiliate/conversions` | affiliate JWT | List active paid subscribers |
| `GET` | `/api/affiliate/monthly-earnings` | affiliate JWT | Monthly breakdown with payout status |
| `POST` | `/api/affiliate/payout-request` | affiliate JWT | Request payout for a past month |
| `GET` | `/api/admin/affiliates/:id` | admin JWT | Full affiliate profile |
| `GET` | `/api/admin/payout-requests` | admin JWT | All payout requests (pending first) |
| `POST` | `/api/admin/payout-requests/:id/approve` | admin JWT | Mark request paid, write ledger deduction |

### Modified

- `api/affiliate/payouts.ts` — extend response to include per-month request status
- `api/admin/[id]/mark-paid.ts` — deprecated; all new payments go through `approve` endpoint

### DB migration

Add `period VARCHAR(7)` (format `YYYY-MM`) to `affiliate_payouts` table.  
Add unique constraint: `UNIQUE (affiliate_id, period)`.

---

## 5. Screen Designs

### 5.1 PT Dashboard `/pt` — Monthly Earnings Extension

Below the existing payout history table, add **"Thu nhập theo tháng"** section.

**Table columns:** Tháng | Hoa hồng | Khấu trừ | Thực nhận | Trạng thái | Action

**Status values:**
- `Đang tích lũy` — current month, no action
- `Chưa yêu cầu` — past month, balance > 0, button: **"Yêu cầu thanh toán"**
- `Chờ xử lý` — request submitted, awaiting admin
- `Đã thanh toán` — paid, show ✓

**Request modal:** shows month label + net amount. Single confirm button. Closes on success, row status updates to `Chờ xử lý`.

---

### 5.2 PT Conversions `/pt/conversions` — New Page

Nav label: **"Doanh thu"** (added to `ptLinks` in `nav.ts`)

Shows only `status = 'converted'` (active paid subscribers). No PII — user identity is anonymous.

**Table columns:** # | Ngày đăng ký | Trạng thái

**Empty state:** "Chia sẻ mã của bạn để bắt đầu"

---

### 5.3 Admin Overview `/admin` — Extend Rows

Affiliate rows in the table become clickable (`cursor-pointer`, hover highlight).  
Clicking navigates to `/admin/affiliates/:id`.

Remove inline "Đánh dấu đã trả" button from this table (payments now handled via `/admin/payouts`).

---

### 5.4 Admin Affiliate Detail `/admin/affiliates/:id` — New Page

**Header:** Affiliate name, code badge, status badge (active/pending/suspended).

**Four tabs:**

**Tab 1 — Hồ sơ**
- Bank info: bank name, account holder, account number, routing/swift
- Read-only display (affiliate edits via their own BankInfo page)
- Shows "Chưa có thông tin" if not filled

**Tab 2 — Thu nhập**
- Monthly earnings table (same columns as PT view)
- Admin sees payout request status per month
- No action button here — payments handled in `/admin/payouts`

**Tab 3 — Chuyển đổi**
- List of paid subscribers attributed to this affiliate
- Columns: # | Ngày đăng ký | Trạng thái

**Tab 4 — Sổ cái**
- Raw ledger entries
- Columns: Ngày | Loại | Số tiền | Ghi chú
- Entry types: credit (green), reversal (red), payout_deduction (gray)

---

### 5.5 Admin Payout Queue `/admin/payouts` — New Page

Nav label: **"Thanh toán"** (added to `adminLinks`).

Two sections:
1. **Chờ xử lý** — pending requests sorted by requested_at ascending (oldest first)
2. **Đã hoàn thành** — recent paid requests (last 3 months)

**Table columns:** Affiliate | Tháng | Số tiền | Yêu cầu lúc | Trạng thái | Action

**Approve modal:** shows affiliate name, month, amount. Optional admin note field. Confirm button → calls approve endpoint → row moves to completed section.

---

## 6. New TypeScript Types

```typescript
// Affiliate side
interface MonthlyEarning {
  month: string;           // "2026-06"
  credits: number;         // sum of 'credit' entries with created_at in that month
  reversals: number;       // sum of 'reversal' entries with created_at in that month
  net: number;             // credits - reversals for that month only (not cumulative)
  payoutStatus: "accumulating" | "unrequested" | "pending" | "paid";
  payoutRequestId: string | null;
}

interface Conversion {
  joinedAt: string;
  status: "converted";
}

// Admin side
interface AdminAffiliateDetail {
  affiliateId: string;
  name: string;
  code: string;
  status: string;
  bankInfo: BankInfo | null;
  monthlyEarnings: MonthlyEarning[];
  conversions: Conversion[];
  ledgerEntries: LedgerEntry[];
}

interface LedgerEntry {
  id: string;
  entryType: "credit" | "reversal" | "payout_deduction" | "debit";
  amount: number;
  note: string | null;
  createdAt: string;
}

interface PayoutRequest {
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

---

## 7. File Changes

### New files
- `api/affiliate/conversions.ts`
- `api/affiliate/monthly-earnings.ts`
- `api/affiliate/payout-request.ts`
- `api/admin/affiliates/[id].ts`
- `api/admin/payout-requests/index.ts`
- `api/admin/payout-requests/[id]/approve.ts`
- `src/pages/pt/Conversions.tsx`
- `src/pages/admin/AffiliateDetail.tsx`
- `src/pages/admin/PayoutQueue.tsx`

### Modified files
- `src/App.tsx` — add 3 new routes
- `src/pages/pt/nav.ts` — add "Doanh thu" link
- `src/pages/pt/Dashboard.tsx` — add monthly earnings table + request modal
- `src/pages/admin/Overview.tsx` — make rows clickable, remove inline mark-paid button
- `src/types/index.ts` — add new types
- `api/affiliate/payouts.ts` — include period in response
- DB migration — add `period` column + unique constraint to `affiliate_payouts`

---

## 8. Out of Scope

- Admin editing affiliate bank info (read-only for now)
- Email notifications on payout request / approval
- Bulk approve multiple requests at once
- Export to CSV
