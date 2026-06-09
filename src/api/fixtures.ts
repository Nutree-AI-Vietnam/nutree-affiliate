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
    session: { affiliateId: "a1", name: "Alex R.", email: "alex@pt.com", role: "pt", onboarded: true },
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
    session: { affiliateId: "a2", name: "Sam T.", email: "sam@pt.com", role: "pt", onboarded: true },
    password: "password",
    bankInfo: null,
    pendingTrials: 5,
    activeSubscriptions: 31,
    totalRevenue: 2310,
    lastPaidDate: null,
    payouts: [{ period: "2026-06", conversions: 2, amount: 20, status: "pending", paidDate: null }],
  },
  {
    session: { affiliateId: "a3", name: "Jo K.", email: "jo@pt.com", role: "pt", onboarded: true },
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
  affiliateId: "admin1", name: "Nutree Admin", email: "admin@nutree.app", role: "admin", onboarded: true,
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
