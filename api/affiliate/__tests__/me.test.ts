import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../_lib/db", () => ({ sql: vi.fn() }));
vi.mock("../../_lib/auth", () => ({
  verifyAuth: vi.fn(),
  ApiError: class ApiError extends Error {
    constructor(public status: number, msg: string) { super(msg); }
  },
}));

import { sql } from "../../_lib/db";
import { verifyAuth } from "../../_lib/auth";

const mockSql = sql as unknown as ReturnType<typeof vi.fn>;
const mockVerifyAuth = verifyAuth as ReturnType<typeof vi.fn>;

function makeRes() {
  const res = { statusCode: 200, body: "" as unknown } as Record<string, unknown>;
  res["status"] = vi.fn((code: number) => { res["statusCode"] = code; return res; });
  res["json"] = vi.fn((data: unknown) => { res["body"] = data; return res; });
  return res;
}

describe("GET /api/affiliate/me", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyAuth.mockResolvedValue({
      uid: "firebase-uid-1",
      name: "Alex",
      email: "alex@test.com",
    });
  });

  it("returns 401 if auth fails", async () => {
    vi.resetModules();
    const { ApiError } = await import("../../_lib/auth");
    mockVerifyAuth.mockRejectedValue(new ApiError(401, "Unauthorized"));
    const handler = (await import("../me")).default;
    const req = { headers: {}, method: "GET" } as never;
    const res = makeRes();
    await handler(req, res as never);
    expect(res["statusCode"]).toBe(401);
  });

  it("returns existing affiliate profile", async () => {
    mockSql
      .mockResolvedValueOnce([{
        id: "aff-1", firebase_uid: "firebase-uid-1",
        name: "Alex", email: "alex@test.com", role: "pt",
      }])
      .mockResolvedValueOnce([{ code: "ABCD1234" }]);

    const handler = (await import("../me")).default;
    const req = { headers: { authorization: "Bearer tok" }, method: "GET" } as never;
    const res = makeRes();
    await handler(req, res as never);
    expect(res["statusCode"]).toBe(200);
    expect((res["body"] as { referralCode: string }).referralCode).toBe("ABCD1234");
  });

  it("creates new affiliate on first login", async () => {
    mockSql
      .mockResolvedValueOnce([])  // affiliate not found
      .mockResolvedValueOnce([])  // INSERT affiliates
      .mockResolvedValueOnce([])  // INSERT referral_codes
      .mockResolvedValueOnce([]); // INSERT referral_wallets

    const handler = (await import("../me")).default;
    const req = { headers: { authorization: "Bearer tok" }, method: "GET" } as never;
    const res = makeRes();
    await handler(req, res as never);
    expect(res["statusCode"]).toBe(200);
    expect(typeof (res["body"] as { referralCode: string }).referralCode).toBe("string");
  });
});
