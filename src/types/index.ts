export type Role = "pt" | "admin";

export interface Session {
  affiliateId: string;
  name: string;
  email: string;
  role: Role;
  onboarded: boolean;
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
