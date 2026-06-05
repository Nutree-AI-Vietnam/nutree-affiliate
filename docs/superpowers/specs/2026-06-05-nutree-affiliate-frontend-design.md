# Nutree Affiliate System — Frontend Design Spec

**Date:** 2026-06-05
**Scope:** Frontend only. The backend (auth, database access, payout logic) will be implemented later by a separate team against the data contract defined here.

## 1. Overview

A simple affiliate system for Nutree (think "GoMarketMe but simpler"), aimed at Personal Trainers (PTs) who refer users to the Nutree app. PTs get a referral code, shareable link, and QR code, and track their conversions and payouts. An admin oversees total revenue and all affiliates.

The main Nutree app (separate system, backed by Neon Postgres) already handles referral attribution: it records which referral code each user signed up with, and tracks their trial/subscription status and revenue. This affiliate system primarily **reads** that conversion data and provides the PT self-service + admin dashboards on top of it.

## 2. Goals & Non-Goals

**Goals**
- PT-facing: login, referral code + unique link + QR code, bank info capture, personal stats dashboard.
- Admin-facing: total revenue headline, affiliate tracking table, mark payouts as paid.
- A fully clickable frontend backed by a typed mock API + fixtures, ready for the backend team to wire up.

**Non-Goals (deferred to backend team)**
- Real authentication / password storage.
- Real database access (Neon) and the read-only view over main-app tables.
- Automated payouts / payment-provider integration (payouts are **track-only**, transferred manually by admin).
- Referral attribution capture (already handled by the main Nutree backend).

## 3. Tech Stack

- **Vite + React + TypeScript** single-page app.
- **React Router** for routing.
- **Tailwind CSS** for styling.
- **qrcode** library for client-side QR generation from the referral link.
- Deployed to **Vercel** as a static SPA.

## 4. Architecture

```
src/
  types/        Domain types (Affiliate, Session, MyStats, ReferralInfo, BankInfo, AdminOverview, AffiliateRow, Payout)
  api/
    index.ts    AffiliateApi interface (the backend contract)
    mockApi.ts  Mock implementation backed by fixtures
    fixtures.ts Realistic sample data
  auth/
    session.ts  Mock session persisted to localStorage (role + current affiliate)
    guard.tsx   Route guard for pt vs admin roles
  pages/
    Login.tsx
    Register.tsx
    pt/Dashboard.tsx
    pt/Referral.tsx
    pt/BankInfo.tsx
    admin/Overview.tsx
  components/
    StatCard.tsx
    DataTable.tsx
    QrCode.tsx
    BankInfoForm.tsx
    NavBar.tsx
```

Components only ever import the `AffiliateApi` interface, never the mock directly (the mock is injected/selected in one place). Swapping mock → real backend is a single wiring change.

## 5. Data Contract (`AffiliateApi`)

```ts
interface AffiliateApi {
  // Auth
  login(email: string, password: string): Promise<Session>;
  register(input: { email: string; password: string; name: string }): Promise<Session>;
  logout(): Promise<void>;

  // PT
  getMyStats(): Promise<MyStats>;
  getMyReferral(): Promise<ReferralInfo>;
  getMyBankInfo(): Promise<BankInfo | null>;
  saveBankInfo(info: BankInfo): Promise<BankInfo>;
  getMyPayouts(): Promise<Payout[]>;

  // Admin
  getAdminOverview(): Promise<AdminOverview>;
  markPayoutPaid(affiliateId: string, note?: string): Promise<void>;
  getCommissionSetting(): Promise<{ commissionPerConversion: number }>;
}
```

**Types**

```ts
type Role = "pt" | "admin";

interface Session { affiliateId: string; name: string; email: string; role: Role; }

interface MyStats {
  totalRevenue: number;        // gross subscription revenue from this PT's referrals
  totalPayout: number;         // owed = activeSubscriptions * commissionPerConversion
  pendingTrials: number;       // referred users currently in trial
  activeSubscriptions: number; // referred users converted to paid
  lastPaymentDate: string | null;
}

interface ReferralInfo { code: string; link: string; } // QR generated client-side from link

interface BankInfo {
  bankName: string;
  accountHolder: string;
  accountNumber: string;   // or IBAN
  routingOrSwift?: string;
}

interface Payout {
  period: string;          // e.g. "2026-05"
  conversions: number;
  amount: number;
  status: "pending" | "paid";
  paidDate: string | null;
}

interface AffiliateRow {
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

interface AdminOverview {
  totalRevenue: number;        // across all affiliates
  totalPayoutOwed: number;
  activeAffiliates: number;
  pendingTrials: number;
  activeSubscriptions: number;
  commissionPerConversion: number;
  affiliates: AffiliateRow[];
}
```

## 6. Commission Model

- Fixed amount per conversion, **one-time** when a referred user converts trial → paid.
- **Same global rate** for all PTs (displayed read-only, e.g. `$10`).
- `payoutOwed = activeSubscriptions * commissionPerConversion`. A payout's paid/pending status comes from the backend's payout records; in the mock it lives in fixtures.

## 7. Screens

### 7.1 Auth (Login / Register)
- Email + password fields. Register also collects name.
- On success the mock stores a `Session` in localStorage and routes by role (`pt` → PT dashboard, `admin` → admin overview).
- Referral code is derived from the email at registration (mock generates e.g. `ALEX-NUTREE`).

### 7.2 PT Dashboard (`pt/Dashboard.tsx`)
- Top nav: Dashboard · My Code · Bank Info · Logout.
- Five stat cards: Total Revenue, Total Payout, Pending Trials, Active Subs, Last Payment.
- Referral card: QR + code + copyable link.
- Payout history table: period, conversions, amount, status, paid date.

### 7.3 PT Referral / My Code (`pt/Referral.tsx`)
- Large QR code, referral code, full shareable link with copy button. Optional "download QR" (client-side).

### 7.4 PT Bank Info (`pt/BankInfo.tsx`)
- Form: bank name, account holder, account number/IBAN, routing/SWIFT (optional). Save via `saveBankInfo`. Shows saved state.

### 7.5 Admin Overview (`admin/Overview.tsx`)
- Headline Total Revenue card (with payout-owed + active-affiliate count).
- Secondary stat cards: Pending Trials, Active Subscriptions, Commission/conversion.
- Affiliate table: name, code, pending, active, revenue, payout owed, bank info status, last paid, "Mark paid" action (calls `markPayoutPaid`, optimistic update in mock). Searchable by name/code.

## 8. Error & Empty States

- API calls return typed errors; pages show inline error + retry.
- Loading skeletons on dashboards/tables.
- Empty states: PT with no referrals yet ("Share your link to start earning"); admin with no affiliates.
- Bank info missing is surfaced (PT prompt to add it; admin `⚠️ Missing` badge).

## 9. Testing

- Component tests (Vitest + React Testing Library) for StatCard, DataTable, BankInfoForm, QrCode, and the route guard.
- Mock API unit tests verifying fixtures satisfy the `AffiliateApi` contract and metric math (`payoutOwed = activeSubscriptions * commissionPerConversion`).
- Smoke test of each page rendering against the mock API.

## 10. Handoff to Backend Team

The backend team implements `AffiliateApi` against Neon: real auth (email+password), a read-only view over the main app's user/subscription tables for conversion metrics, an `affiliate` schema for affiliates/bank-info/payouts, a `settings` row for the global commission, and the `markPayoutPaid` mutation. No frontend changes required beyond swapping the injected implementation.
