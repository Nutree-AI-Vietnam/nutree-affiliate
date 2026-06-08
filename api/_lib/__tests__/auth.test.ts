import { describe, it, expect, vi, beforeEach } from "vitest";

const mockVerifyIdToken = vi.fn();

vi.mock("firebase-admin", () => ({
  default: {
    apps: [] as unknown[],
    initializeApp: vi.fn(),
    credential: { cert: vi.fn((sa) => sa) },
    auth: vi.fn(() => ({
      verifyIdToken: mockVerifyIdToken,
    })),
  },
}));

describe("verifyAuth", () => {
  beforeEach(() => {
    process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify({
      type: "service_account",
      project_id: "test",
    });
    vi.resetModules();
    mockVerifyIdToken.mockReset();
  });

  it("throws 401 when Authorization header is missing", async () => {
    const { verifyAuth } = await import("../auth");
    const req = { headers: {} } as never;
    await expect(verifyAuth(req)).rejects.toMatchObject({ status: 401 });
  });

  it("throws 401 when token is invalid", async () => {
    mockVerifyIdToken.mockRejectedValue(new Error("invalid token"));
    const { verifyAuth } = await import("../auth");
    const req = { headers: { authorization: "Bearer bad-token" } } as never;
    await expect(verifyAuth(req)).rejects.toMatchObject({ status: 401 });
  });

  it("returns uid, name, email on valid token", async () => {
    mockVerifyIdToken.mockResolvedValue({
      uid: "firebase-uid-123",
      name: "Alex",
      email: "alex@test.com",
    });
    const { verifyAuth } = await import("../auth");
    const req = {
      headers: { authorization: "Bearer valid-token" },
    } as never;
    const result = await verifyAuth(req);
    expect(result).toEqual({
      uid: "firebase-uid-123",
      name: "Alex",
      email: "alex@test.com",
    });
  });
});
