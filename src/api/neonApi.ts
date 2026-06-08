// src/api/neonApi.ts
import { signInWithPopup, signOut } from "firebase/auth";
import { auth, googleProvider } from "../lib/firebase";
import type { AffiliateApi } from "./index";
import type {
  Session, MyStats, ReferralInfo, BankInfo, Payout, AdminOverview, AffiliateRow,
} from "../types";

const BASE_URL = "/api";

async function authFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  const token = await user.getIdToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  });
  if (res.status === 401) {
    await signOut(auth);
    throw new Error("Session expired");
  }
  if (!res.ok) {
    throw new Error("Something went wrong. Please try again.");
  }
  return res.json() as Promise<T>;
}

interface AffiliateProfile {
  affiliateId: string;
  name: string;
  email: string;
  role: string;
  referralCode: string;
  referralLink: string;
}

interface AffiliateStats {
  balance: number;
  totalEarned: number;
  totalWithdrawn: number;
  pendingTrials: number;
  activeSubscriptions: number;
}

interface PayoutRequest {
  id: string;
  amount: number;
  status: string;
  paymentMethod: string | null;
  paymentDetails: Record<string, string> | null;
  requestedAt: string;
  completedAt: string | null;
  adminNote: string | null;
}

interface AdminOverviewResponse {
  totalRevenue: number;
  totalPayoutOwed: number;
  activeAffiliates: number;
  commissionPerConversion: number;
  affiliates: {
    affiliateId: string;
    name: string;
    code: string;
    pendingTrials: number;
    activeSubscriptions: number;
    totalEarned: number;
    balance: number;
    hasBankInfo: boolean;
    lastPaidDate: string | null;
  }[];
}

export function createNeonApi(): AffiliateApi {
  return {
    async login(): Promise<Session> {
      await signInWithPopup(auth, googleProvider);
      const profile = await authFetch<AffiliateProfile>("/affiliate/me");
      return {
        affiliateId: profile.affiliateId,
        name: profile.name,
        email: profile.email,
        role: profile.role as "pt" | "admin",
      };
    },

    async register(): Promise<Session> {
      throw new Error("Use Google Sign-In");
    },

    async logout(): Promise<void> {
      await signOut(auth);
    },

    async getMyStats(): Promise<MyStats> {
      const [stats, payouts] = await Promise.all([
        authFetch<AffiliateStats>("/affiliate/stats"),
        authFetch<PayoutRequest[]>("/affiliate/payouts"),
      ]);
      const lastPaid = payouts
        .filter((p) => p.status === "paid" && p.completedAt)
        .sort((a, b) => (b.completedAt! > a.completedAt! ? 1 : -1))[0];
      return {
        totalRevenue: stats.totalEarned,
        totalPayout: stats.totalWithdrawn,
        pendingTrials: stats.pendingTrials,
        activeSubscriptions: stats.activeSubscriptions,
        lastPaymentDate: lastPaid?.completedAt?.slice(0, 10) ?? null,
      };
    },

    async getMyReferral(): Promise<ReferralInfo> {
      const profile = await authFetch<AffiliateProfile>("/affiliate/me");
      return { code: profile.referralCode, link: profile.referralLink };
    },

    async getMyBankInfo(): Promise<BankInfo | null> {
      return authFetch<BankInfo | null>("/affiliate/bank-info");
    },

    async saveBankInfo(info: BankInfo): Promise<BankInfo> {
      return authFetch<BankInfo>("/affiliate/bank-info", {
        method: "POST",
        body: JSON.stringify(info),
      });
    },

    async getMyPayouts(): Promise<Payout[]> {
      const rows = await authFetch<PayoutRequest[]>("/affiliate/payouts");
      return rows.map((r) => {
        const date = new Date(r.requestedAt);
        const period = date.toLocaleString("default", { month: "long", year: "numeric" });
        return {
          period,
          conversions: 0,
          amount: r.amount,
          status: r.status as "pending" | "paid",
          paidDate: r.completedAt?.slice(0, 10) ?? null,
        };
      });
    },

    async getAdminOverview(): Promise<AdminOverview> {
      const data = await authFetch<AdminOverviewResponse>("/admin/overview");
      const affiliates: AffiliateRow[] = data.affiliates.map((a) => ({
        affiliateId: a.affiliateId,
        name: a.name,
        code: a.code,
        pendingTrials: a.pendingTrials,
        activeSubscriptions: a.activeSubscriptions,
        totalRevenue: a.totalEarned,
        payoutOwed: a.balance,
        hasBankInfo: a.hasBankInfo,
        lastPaidDate: a.lastPaidDate,
      }));
      return {
        totalRevenue: data.totalRevenue,
        totalPayoutOwed: data.totalPayoutOwed,
        activeAffiliates: data.activeAffiliates,
        pendingTrials: affiliates.reduce((s, a) => s + a.pendingTrials, 0),
        activeSubscriptions: affiliates.reduce((s, a) => s + a.activeSubscriptions, 0),
        commissionPerConversion: data.commissionPerConversion,
        affiliates,
      };
    },

    async markPayoutPaid(affiliateId: string, note?: string): Promise<void> {
      await authFetch(`/admin/${affiliateId}/mark-paid`, {
        method: "POST",
        body: note !== undefined ? JSON.stringify({ note }) : undefined,
      });
    },

    async getCommissionSetting(): Promise<{ commissionPerConversion: number }> {
      const data = await authFetch<AdminOverviewResponse>("/admin/overview");
      return { commissionPerConversion: data.commissionPerConversion };
    },
  };
}
