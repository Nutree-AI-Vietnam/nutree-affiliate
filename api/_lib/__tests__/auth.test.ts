import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockJwtVerify, mockCreateRemoteJWKSet } = vi.hoisted(() => ({
  mockJwtVerify: vi.fn(),
  mockCreateRemoteJWKSet: vi.fn(() => ({})),
}));

vi.mock("jose", () => ({
  createRemoteJWKSet: mockCreateRemoteJWKSet,
  jwtVerify: mockJwtVerify,
}));

describe("verifyAuth", () => {
  beforeEach(() => {
    process.env.NEON_AUTH_BASE_URL = "https://example.neonauth.test/neondb/auth";
    vi.resetModules();
    mockJwtVerify.mockReset();
    mockCreateRemoteJWKSet.mockClear();
    mockCreateRemoteJWKSet.mockReturnValue({});
  });

  it("throws 401 when Authorization header is missing", async () => {
    const { verifyAuth } = await import("../auth");
    const req = { headers: {} } as never;
    await expect(verifyAuth(req)).rejects.toMatchObject({ status: 401 });
  });

  it("throws 401 when token is invalid", async () => {
    mockJwtVerify.mockRejectedValue(new Error("invalid token"));
    const { verifyAuth } = await import("../auth");
    const req = { headers: { authorization: "Bearer bad-token" } } as never;
    await expect(verifyAuth(req)).rejects.toMatchObject({ status: 401 });
  });

  it("returns uid, name, email on valid token", async () => {
    mockJwtVerify.mockResolvedValue({
      payload: {
        sub: "neon-user-123",
        name: "Alex",
        email: "alex@test.com",
      },
    });
    const { verifyAuth } = await import("../auth");
    const req = {
      headers: { authorization: "Bearer valid-token" },
    } as never;
    const result = await verifyAuth(req);

    expect(mockJwtVerify).toHaveBeenCalledWith(
      "valid-token",
      expect.anything(),
      { issuer: "https://example.neonauth.test" },
    );
    expect(result).toEqual({
      uid: "neon-user-123",
      name: "Alex",
      email: "alex@test.com",
    });
  });
});
