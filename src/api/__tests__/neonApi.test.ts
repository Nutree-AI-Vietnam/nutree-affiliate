// src/api/__tests__/neonApi.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../lib/neon-auth", () => ({
  authClient: {
    getSession: vi.fn(),
    signIn: { social: vi.fn() },
    signOut: vi.fn(),
  },
  clearNeonAuthTokenCache: vi.fn(),
  getNeonAuthToken: vi.fn(),
}));

import { authClient, clearNeonAuthTokenCache, getNeonAuthToken } from "../../lib/neon-auth";
import { AUTH_REQUIRED_EVENT } from "../../auth/auth-events";
import { loadSession, saveSession } from "../../auth/session";
import { createNeonApi } from "../neonApi";

const mockAuthClient = authClient as unknown as {
  getSession: ReturnType<typeof vi.fn>;
  signIn: { social: ReturnType<typeof vi.fn> };
  signOut: ReturnType<typeof vi.fn>;
};
const mockGetNeonAuthToken = getNeonAuthToken as ReturnType<typeof vi.fn>;
const mockClearNeonAuthTokenCache = clearNeonAuthTokenCache as ReturnType<typeof vi.fn>;

function mockSignedInSession() {
  mockAuthClient.getSession.mockResolvedValue({
    data: { session: { user: { id: "neon-user-1" } } },
    error: null,
  });
}

function mockFetch(response: unknown, status = 200) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(response),
  }));
}

describe("neonApi", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/");
    vi.clearAllMocks();
    mockAuthClient.getSession.mockResolvedValue({ data: { session: null }, error: null });
    mockGetNeonAuthToken.mockResolvedValue("test-token");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("login()", () => {
    it("starts Google redirect immediately", async () => {
      mockAuthClient.signIn.social.mockResolvedValue(undefined);

      const api = createNeonApi();

      await expect(api.login()).rejects.toThrow("Redirecting to Google sign-in");
      expect(mockAuthClient.signIn.social).toHaveBeenCalledWith({
        provider: "google",
        callbackURL: `${window.location.origin}/login?auth=callback`,
      });
      expect(mockAuthClient.getSession).not.toHaveBeenCalled();
    });

    it("includes next path in the Google callback URL", async () => {
      mockAuthClient.signIn.social.mockResolvedValue(undefined);

      const api = createNeonApi();

      await expect(api.login("/pt/bank")).rejects.toThrow("Redirecting to Google sign-in");
      expect(mockAuthClient.signIn.social).toHaveBeenCalledWith({
        provider: "google",
        callbackURL: `${window.location.origin}/login?auth=callback&next=%2Fpt%2Fbank`,
      });
    });
  });

  describe("getCurrentSession()", () => {
    it("returns Session from /api/affiliate/me when Neon Auth has a session", async () => {
      mockSignedInSession();
      mockFetch({
        affiliateId: "aff-1",
        name: "Alex",
        email: "alex@test.com",
        role: "pt", onboarded: true,
        referralCode: "ABCD1234",
        referralLink: "https://nutree.app/r/ABCD1234",
      });

      const api = createNeonApi();
      const session = await api.getCurrentSession();

      expect(session).toEqual({
        affiliateId: "aff-1",
        name: "Alex",
        email: "alex@test.com",
        role: "pt", onboarded: true,
      });
      expect(mockGetNeonAuthToken).toHaveBeenCalledOnce();
    });

    it("surfaces Neon Auth session errors before loading affiliate data", async () => {
      mockAuthClient.getSession.mockResolvedValue({
        data: null,
        error: { code: "SESSION_CHALLENGE_COOKIE_NOT_FOUND", error: "Session challenge cookie not found" },
      });
      const fetchSpy = vi.fn();
      vi.stubGlobal("fetch", fetchSpy);

      const api = createNeonApi();
      await expect(api.getCurrentSession()).rejects.toThrow("Session challenge cookie not found");

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(mockGetNeonAuthToken).not.toHaveBeenCalled();
    });

    it("treats verifier callbacks without a session as terminal callback failures", async () => {
      window.history.pushState({}, "", "/login?auth=callback&neon_auth_session_verifier=missing-cookie");
      mockAuthClient.getSession.mockResolvedValue({ data: { session: null }, error: null });
      const fetchSpy = vi.fn();
      vi.stubGlobal("fetch", fetchSpy);

      const api = createNeonApi();
      await expect(api.getCurrentSession()).rejects.toThrow("Session challenge cookie not found");

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(mockGetNeonAuthToken).not.toHaveBeenCalled();
    });
  });

  describe("logout()", () => {
    it("calls signOut", async () => {
      mockAuthClient.signOut.mockResolvedValue(undefined);
      const api = createNeonApi();
      await api.logout();
      expect(mockAuthClient.signOut).toHaveBeenCalledOnce();
    });
  });

  describe("authFetch on 401", () => {
    it("clears auth, broadcasts auth-required, and throws on 401 response", async () => {
      mockGetNeonAuthToken.mockResolvedValue("expired-token");
      mockAuthClient.signOut.mockResolvedValue(undefined);
      saveSession({ affiliateId: "aff-1", name: "Alex", email: "alex@test.com", role: "pt", onboarded: true });
      const authRequiredListener = vi.fn();
      window.addEventListener(AUTH_REQUIRED_EVENT, authRequiredListener);
      mockFetch({ error: "Unauthorized" }, 401);

      const api = createNeonApi();
      await expect(api.getMyReferral()).rejects.toThrow("Session expired");
      expect(mockClearNeonAuthTokenCache).toHaveBeenCalledOnce();
      expect(loadSession()).toBeNull();
      expect(authRequiredListener).toHaveBeenCalledOnce();
      expect(mockAuthClient.signOut).toHaveBeenCalledOnce();
      window.removeEventListener(AUTH_REQUIRED_EVENT, authRequiredListener);
    });
  });

  describe("getMyStats()", () => {
    it("maps AffiliateStats to MyStats", async () => {
      mockFetch({
        balance: 600000,
        totalEarned: 900000,
        totalWithdrawn: 300000,
        pendingTrials: 2,
        activeSubscriptions: 3,
        lastPaidDate: "2026-05-03",
      });

      const api = createNeonApi();
      const stats = await api.getMyStats();

      expect(stats.totalRevenue).toBe(900000);
      expect(stats.totalPayout).toBe(300000);
      expect(stats.pendingTrials).toBe(2);
      expect(stats.activeSubscriptions).toBe(3);
      expect(stats.lastPaymentDate).toBe("2026-05-03");
      expect(fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("getMyReferral()", () => {
    it("returns code and link from /api/affiliate/me", async () => {
      mockFetch({
        affiliateId: "aff-1", name: "Alex", email: "alex@test.com",
        role: "pt", referralCode: "ABCD1234",
        referralLink: "https://nutree.app/r/ABCD1234",
      });

      const api = createNeonApi();
      const ref = await api.getMyReferral();
      expect(ref.code).toBe("ABCD1234");
      expect(ref.link).toBe("https://nutree.app/r/ABCD1234");
    });
  });

  describe("getMyBankInfo()", () => {
    it("returns null when bank info is not set", async () => {
      mockFetch(null);
      const api = createNeonApi();
      expect(await api.getMyBankInfo()).toBeNull();
    });

    it("returns bank info when set", async () => {
      const bankInfo = { bankName: "VCB", accountHolder: "ALEX", accountNumber: "123" };
      mockFetch(bankInfo);
      const api = createNeonApi();
      expect(await api.getMyBankInfo()).toEqual(bankInfo);
    });
  });

  describe("saveBankInfo()", () => {
    it("POSTs bank info and returns saved value", async () => {
      const bankInfo = { bankName: "VCB", accountHolder: "ALEX", accountNumber: "123" };
      mockFetch(bankInfo);
      const api = createNeonApi();
      const result = await api.saveBankInfo(bankInfo);
      expect(result).toEqual(bankInfo);
      const fetchCall = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(fetchCall[1].method).toBe("POST");
      expect(JSON.parse(fetchCall[1].body as string)).toEqual(bankInfo);
    });
  });

  describe("getMyPayouts()", () => {
    it("maps PayoutRequests to Payout[] with period formatted", async () => {
      mockFetch([{
        id: "p1", amount: 300000, status: "paid",
        requestedAt: "2026-05-01T00:00:00Z",
        completedAt: "2026-05-03T00:00:00Z",
        paymentMethod: null, paymentDetails: null, adminNote: null,
      }]);
      const api = createNeonApi();
      const payouts = await api.getMyPayouts();
      expect(payouts).toHaveLength(1);
      expect(payouts[0].amount).toBe(300000);
      expect(payouts[0].status).toBe("paid");
      expect(payouts[0].paidDate).toBe("2026-05-03");
      expect(payouts[0].conversions).toBe(0);
      expect(typeof payouts[0].period).toBe("string");
    });
  });

  describe("getAdminOverview()", () => {
    it("maps AdminOverviewResponse to AdminOverview with derived totals", async () => {
      mockFetch({
        totalRevenue: 1200000,
        totalPayoutOwed: 900000,
        activeAffiliates: 2,
        commissionPerConversion: 300000,
        affiliates: [
          {
            affiliateId: "a1", name: "Alex", code: "ABCD1234",
            pendingTrials: 1, activeSubscriptions: 3,
            totalEarned: 900000, balance: 600000,
            hasBankInfo: true, lastPaidDate: "2026-05-03",
          },
          {
            affiliateId: "a2", name: "Sam", code: "EFG56789",
            pendingTrials: 0, activeSubscriptions: 1,
            totalEarned: 300000, balance: 300000,
            hasBankInfo: false, lastPaidDate: null,
          },
        ],
      });

      const api = createNeonApi();
      const overview = await api.getAdminOverview();

      expect(overview.totalRevenue).toBe(1200000);
      expect(overview.totalPayoutOwed).toBe(900000);
      expect(overview.activeAffiliates).toBe(2);
      expect(overview.commissionPerConversion).toBe(300000);
      expect(overview.pendingTrials).toBe(1);
      expect(overview.activeSubscriptions).toBe(4);
      expect(overview.affiliates[0].totalRevenue).toBe(900000);
      expect(overview.affiliates[0].payoutOwed).toBe(600000);
      expect(overview.affiliates[1].hasBankInfo).toBe(false);
    });
  });

  describe("markPayoutPaid()", () => {
    it("POSTs to /api/admin/[id]/mark-paid", async () => {
      mockFetch({ ok: true });

      const api = createNeonApi();
      await api.markPayoutPaid("aff-123");

      const fetchCall = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(fetchCall[0]).toContain("/admin/aff-123/mark-paid");
      expect(fetchCall[1].method).toBe("POST");
    });

    it("includes note in request body when provided", async () => {
      mockFetch({ ok: true });

      const api = createNeonApi();
      await api.markPayoutPaid("aff-123", "Paid via bank transfer");

      const fetchCall = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(JSON.parse(fetchCall[1].body as string)).toEqual({ note: "Paid via bank transfer" });
    });
  });

  describe("getCommissionSetting()", () => {
    it("returns commissionPerConversion from admin overview", async () => {
      mockFetch({
        totalRevenue: 0, totalPayoutOwed: 0, activeAffiliates: 0,
        commissionPerConversion: 300000, affiliates: [],
      });

      const api = createNeonApi();
      const setting = await api.getCommissionSetting();
      expect(setting.commissionPerConversion).toBe(300000);
    });
  });
});
