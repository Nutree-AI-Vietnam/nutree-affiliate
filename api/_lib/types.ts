// api/_lib/types.ts

export interface AffiliateProfile {
  affiliateId: string;
  name: string;
  email: string;
  /** partner_type ('kol'|'pt') for affiliates, 'admin' for admin accounts */
  role: string;
  referralCode: string;
  referralLink: string;
  onboarded: boolean;
}

export interface AffiliateStats {
  balance: number;
  totalEarned: number;
  totalWithdrawn: number;
  pendingTrials: number;
  activeSubscriptions: number;
  lastPaidDate: string | null;
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
