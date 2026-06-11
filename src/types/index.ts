/** 'kol' and 'pt' are partner roles; 'admin' is the portal admin */
export type Role = "kol" | "pt" | "admin";

export interface Session {
  affiliateId: string;
  name: string;
  email: string;
  role: Role;
  onboarded: boolean;
  adminToken?: string;
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
  bankInfo: BankInfo | null;
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
