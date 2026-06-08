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
});
