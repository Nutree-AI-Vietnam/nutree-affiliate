// src/api/__tests__/neonApi.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock firebase/auth module
vi.mock("firebase/auth", () => ({
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
  GoogleAuthProvider: vi.fn(),
}));

// Mock src/lib/firebase.ts
vi.mock("../../lib/firebase", () => ({
  auth: {
    currentUser: null as unknown,
  },
  googleProvider: {},
}));

import { signInWithPopup, signOut } from "firebase/auth";
import * as firebaseLib from "../../lib/firebase";
import { createNeonApi } from "../neonApi";

const mockSignIn = signInWithPopup as ReturnType<typeof vi.fn>;
const mockSignOut = signOut as ReturnType<typeof vi.fn>;

function setCurrentUser(user: { uid: string; displayName: string; email: string; getIdToken: () => Promise<string> } | null) {
  (firebaseLib.auth as Record<string, unknown>).currentUser = user;
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
    vi.clearAllMocks();
    setCurrentUser(null);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("login()", () => {
    it("signs in with Google and returns Session from /api/affiliate/me", async () => {
      const mockUser = {
        uid: "firebase-uid-1",
        displayName: "Alex",
        email: "alex@test.com",
        getIdToken: vi.fn().mockResolvedValue("test-token"),
      };
      mockSignIn.mockResolvedValue({ user: mockUser });
      setCurrentUser(mockUser);
      mockFetch({
        affiliateId: "aff-1",
        name: "Alex",
        email: "alex@test.com",
        role: "pt",
        referralCode: "ABCD1234",
        referralLink: "https://nutree.app/r/ABCD1234",
      });

      const api = createNeonApi();
      const session = await api.login();

      expect(session).toEqual({
        affiliateId: "aff-1",
        name: "Alex",
        email: "alex@test.com",
        role: "pt",
      });
    });
  });

  describe("logout()", () => {
    it("calls signOut", async () => {
      mockSignOut.mockResolvedValue(undefined);
      const api = createNeonApi();
      await api.logout();
      expect(mockSignOut).toHaveBeenCalledOnce();
    });
  });

  describe("authFetch on 401", () => {
    it("calls logout and throws on 401 response", async () => {
      const mockUser = {
        uid: "firebase-uid-1",
        displayName: "Alex",
        email: "alex@test.com",
        getIdToken: vi.fn().mockResolvedValue("expired-token"),
      };
      setCurrentUser(mockUser);
      mockSignOut.mockResolvedValue(undefined);
      mockFetch({ error: "Unauthorized" }, 401);

      const api = createNeonApi();
      await expect(api.getMyReferral()).rejects.toThrow("Session expired");
      expect(mockSignOut).toHaveBeenCalledOnce();
    });
  });

  describe("getMyStats()", () => {
    it("maps AffiliateStats + payouts to MyStats", async () => {
      const mockUser = {
        uid: "u1",
        displayName: "Alex",
        email: "alex@test.com",
        getIdToken: vi.fn().mockResolvedValue("tok"),
      };
      setCurrentUser(mockUser);

      vi.stubGlobal("fetch", vi.fn()
        .mockResolvedValueOnce({
          ok: true, status: 200,
          json: () => Promise.resolve({
            balance: 600000,
            totalEarned: 900000,
            totalWithdrawn: 300000,
            pendingTrials: 2,
            activeSubscriptions: 3,
          }),
        })
        .mockResolvedValueOnce({
          ok: true, status: 200,
          json: () => Promise.resolve([
            {
              id: "p1", amount: 300000, status: "paid",
              completedAt: "2026-05-03T00:00:00Z",
              requestedAt: "2026-05-01T00:00:00Z",
              paymentMethod: null, paymentDetails: null, adminNote: null,
            },
          ]),
        })
      );

      const api = createNeonApi();
      const stats = await api.getMyStats();

      expect(stats.totalRevenue).toBe(900000);
      expect(stats.totalPayout).toBe(300000);
      expect(stats.pendingTrials).toBe(2);
      expect(stats.activeSubscriptions).toBe(3);
      expect(stats.lastPaymentDate).toBe("2026-05-03");
    });

    it("returns null lastPaymentDate when no paid payouts", async () => {
      const mockUser = {
        uid: "u1",
        displayName: "Alex",
        email: "alex@test.com",
        getIdToken: vi.fn().mockResolvedValue("tok"),
      };
      setCurrentUser(mockUser);

      vi.stubGlobal("fetch", vi.fn()
        .mockResolvedValueOnce({
          ok: true, status: 200,
          json: () => Promise.resolve({
            balance: 0, totalEarned: 0, totalWithdrawn: 0,
            pendingTrials: 0, activeSubscriptions: 0,
          }),
        })
        .mockResolvedValueOnce({
          ok: true, status: 200,
          json: () => Promise.resolve([]),
        })
      );

      const api = createNeonApi();
      const stats = await api.getMyStats();
      expect(stats.lastPaymentDate).toBeNull();
    });
  });

  describe("getMyReferral()", () => {
    it("returns code and link from /api/affiliate/me", async () => {
      const mockUser = {
        uid: "u1",
        displayName: "Alex",
        email: "alex@test.com",
        getIdToken: vi.fn().mockResolvedValue("tok"),
      };
      setCurrentUser(mockUser);
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
      const mockUser = {
        uid: "u1", displayName: "Alex", email: "a@t.com",
        getIdToken: vi.fn().mockResolvedValue("tok"),
      };
      setCurrentUser(mockUser);
      mockFetch(null);
      const api = createNeonApi();
      expect(await api.getMyBankInfo()).toBeNull();
    });

    it("returns bank info when set", async () => {
      const mockUser = {
        uid: "u1", displayName: "Alex", email: "a@t.com",
        getIdToken: vi.fn().mockResolvedValue("tok"),
      };
      setCurrentUser(mockUser);
      const bankInfo = { bankName: "VCB", accountHolder: "ALEX", accountNumber: "123" };
      mockFetch(bankInfo);
      const api = createNeonApi();
      expect(await api.getMyBankInfo()).toEqual(bankInfo);
    });
  });

  describe("saveBankInfo()", () => {
    it("POSTs bank info and returns saved value", async () => {
      const mockUser = {
        uid: "u1", displayName: "Alex", email: "a@t.com",
        getIdToken: vi.fn().mockResolvedValue("tok"),
      };
      setCurrentUser(mockUser);
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
      const mockUser = {
        uid: "u1", displayName: "Alex", email: "a@t.com",
        getIdToken: vi.fn().mockResolvedValue("tok"),
      };
      setCurrentUser(mockUser);
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
});
