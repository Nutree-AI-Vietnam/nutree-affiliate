import { notifyAuthRequired } from "../auth/auth-events";
import { clearSession, loadSession } from "../auth/session";
import type { AffiliateApi } from "./index";
import { authClient, clearNeonAuthTokenCache, getNeonAuthToken } from "../lib/neon-auth";
import type {
  Session, MyStats, ReferralInfo, BankInfo, Payout, AdminOverview, AffiliateRow,
  MonthlyEarning, Conversion, AdminPayoutRequest, AdminAffiliateDetail, LedgerEntry,
} from "../types";

const BASE_URL = "/api";

async function authFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  // Admin users have no Neon Auth session — use their signed adminToken instead
  const session = loadSession();
  let token: string;
  if (session?.role === "admin" && session.adminToken) {
    token = session.adminToken;
  } else {
    token = await getNeonAuthToken();
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  });
  if (res.status === 401) {
    if (!session?.adminToken) {
      clearNeonAuthTokenCache();
      clearSession();
      notifyAuthRequired();
      await authClient.signOut();
    }
    throw new Error("Session expired");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? "Something went wrong. Please try again.");
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
  onboarded: boolean;
}

interface AffiliateStats {
  balance: number;
  totalEarned: number;
  totalWithdrawn: number;
  pendingTrials: number;
  activeSubscriptions: number;
  lastPaidDate: string | null;
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
    async login(nextPath?: string): Promise<Session> {
      const callbackUrl = new URL("/login", window.location.origin);
      callbackUrl.searchParams.set("auth", "callback");
      if (nextPath) callbackUrl.searchParams.set("next", nextPath);
      await authClient.signIn.social({
        provider: "google",
        callbackURL: callbackUrl.toString(),
      });
      throw new Error("Redirecting to Google sign-in");
    },

    async getCurrentSession(): Promise<Session | null> {
      const { data } = await authClient.getSession();
      if (!data?.session) return null;
      const profile = await authFetch<AffiliateProfile>("/affiliate/me");
      return {
        affiliateId: profile.affiliateId,
        name: profile.name,
        email: profile.email,
        role: profile.role as "kol" | "pt" | "admin",
        onboarded: profile.onboarded,
      };
    },

    async register(): Promise<Session> {
      throw new Error("Use Google Sign-In");
    },

    async logout(): Promise<void> {
      clearNeonAuthTokenCache();
      await authClient.signOut();
    },

    async getMyStats(): Promise<MyStats> {
      const stats = await authFetch<AffiliateStats>("/affiliate/stats");
      return {
        totalRevenue: stats.totalEarned,
        totalPayout: stats.totalWithdrawn,
        pendingTrials: stats.pendingTrials,
        activeSubscriptions: stats.activeSubscriptions,
        lastPaymentDate: stats.lastPaidDate,
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
        body: JSON.stringify({ note: note ?? null }),
      });
    },

    async getCommissionSetting(): Promise<{ commissionPerConversion: number }> {
      const data = await authFetch<AdminOverviewResponse>("/admin/overview");
      return { commissionPerConversion: data.commissionPerConversion };
    },

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
  };
}
