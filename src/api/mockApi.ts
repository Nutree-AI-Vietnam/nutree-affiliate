import type { AffiliateApi } from "./index";
import type { Session, MyStats, ReferralInfo, BankInfo, Payout, AdminOverview } from "../types";
import {
  affiliates, adminSession, COMMISSION_PER_CONVERSION,
  toAffiliateRow, codeFromEmail, type FixtureAffiliate,
} from "./fixtures";

const delay = () => new Promise((r) => setTimeout(r, 150));

export interface MockApi extends AffiliateApi {
  /** Test helper: set which user will be returned on the next login() call. */
  loginAs(email: string): void;
}

export function createMockApi(): MockApi {
  const data: FixtureAffiliate[] = affiliates.map((a) => ({ ...a, bankInfo: a.bankInfo }));
  let current: Session | null = null;
  // Default: first PT affiliate (alex@pt.com)
  let nextLoginEmail: string = affiliates[0].session.email;

  return {
    loginAs(email: string) {
      nextLoginEmail = email;
    },

    async login(_nextPath?: string) {
      await delay();
      if (nextLoginEmail === adminSession.email) {
        current = adminSession; return adminSession;
      }
      const a = data.find((x) => x.session.email === nextLoginEmail);
      if (!a) throw new Error(`No fixture user with email: ${nextLoginEmail}`);
      current = a.session; return a.session;
    },

    async getCurrentSession() {
      await delay();
      return current;
    },

    async register() {
      await delay();
      // In Google-only flow, register behaves like login for the next queued user
      return this.login();
    },

    async logout() { await delay(); current = null; },

    async getMyStats(): Promise<MyStats> {
      await delay();
      const a = me();
      return {
        totalRevenue: a.totalRevenue,
        totalPayout: a.activeSubscriptions * COMMISSION_PER_CONVERSION,
        pendingTrials: a.pendingTrials,
        activeSubscriptions: a.activeSubscriptions,
        lastPaymentDate: a.lastPaidDate,
      };
    },
    async getMyReferral(): Promise<ReferralInfo> {
      await delay();
      const code = codeFromEmail(me().session.email);
      return { code, link: `https://nutree.app/r/${code}` };
    },
    async getMyBankInfo(): Promise<BankInfo | null> { await delay(); return me().bankInfo; },
    async saveBankInfo(info): Promise<BankInfo> { await delay(); me().bankInfo = info; return info; },
    async getMyPayouts(): Promise<Payout[]> { await delay(); return me().payouts; },

    async getAdminOverview(): Promise<AdminOverview> {
      await delay();
      const rows = data.map(toAffiliateRow);
      return {
        totalRevenue: rows.reduce((s, r) => s + r.totalRevenue, 0),
        totalPayoutOwed: rows.reduce((s, r) => s + r.payoutOwed, 0),
        activeAffiliates: rows.length,
        pendingTrials: rows.reduce((s, r) => s + r.pendingTrials, 0),
        activeSubscriptions: rows.reduce((s, r) => s + r.activeSubscriptions, 0),
        commissionPerConversion: COMMISSION_PER_CONVERSION,
        affiliates: rows,
      };
    },
    async markPayoutPaid(affiliateId, _note) {
      await delay();
      const a = data.find((x) => x.session.affiliateId === affiliateId);
      if (!a) throw new Error("Affiliate not found");
      a.lastPaidDate = new Date().toISOString().slice(0, 10);
      a.payouts = a.payouts.map((p) =>
        p.status === "pending" ? { ...p, status: "paid", paidDate: a.lastPaidDate } : p);
    },
    async getCommissionSetting() { await delay(); return { commissionPerConversion: COMMISSION_PER_CONVERSION }; },

    async getMyConversions() { return []; },
    async getMyMonthlyEarnings() { return []; },
    async requestPayout() { return { id: "", status: "pending", period: "", requestedAt: "" }; },
    async getAdminAffiliateDetail() {
      return { affiliateId: "", name: "", code: "", status: "", bankInfo: null, monthlyEarnings: [], conversions: [], ledgerEntries: [] };
    },
    async getAdminPayoutRequests() { return []; },
    async approvePayoutRequest() { return { status: "paid", period: "" }; },
  };

  function me(): FixtureAffiliate {
    const found = data.find((a) => a.session.affiliateId === current?.affiliateId);
    if (!found) throw new Error("Not authenticated as a PT");
    return found;
  }
}
