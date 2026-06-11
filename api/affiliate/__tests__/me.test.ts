import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

vi.mock("../../_lib/db", () => ({ sql: vi.fn() }));
vi.mock("../../_lib/auth", () => ({
  verifyAuth: vi.fn(),
  ApiError: class ApiError extends Error {
    constructor(public status: number, msg: string) { super(msg); }
  },
}));

import { sql } from "../../_lib/db";
import { verifyAuth } from "../../_lib/auth";

const mockSql = sql as unknown as ReturnType<typeof vi.fn> & {
  transaction: ReturnType<typeof vi.fn>;
};
const mockVerifyAuth = verifyAuth as ReturnType<typeof vi.fn>;

function makeRes() {
  const res = { statusCode: 200, body: "" as unknown } as Record<string, unknown>;
  res["status"] = vi.fn((code: number) => { res["statusCode"] = code; return res; });
  res["json"] = vi.fn((data: unknown) => { res["body"] = data; return res; });
  return res;
}

describe("GET /api/affiliate/me", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let handler: (req: any, res: any) => Promise<void>;

  beforeAll(async () => {
    handler = (await import("../me")).default;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockSql.transaction = vi.fn();
    mockVerifyAuth.mockResolvedValue({
      uid: "firebase-uid-1",
      name: "Alex",
      email: "alex@test.com",
    });
  });

  it("returns 405 on non-GET", async () => {
    const req = { headers: {}, method: "POST" };
    const res = makeRes();
    await handler(req, res);
    expect(res["statusCode"]).toBe(405);
  });

  it("returns 401 if auth fails", async () => {
    const { ApiError } = await import("../../_lib/auth");
    mockVerifyAuth.mockRejectedValue(new ApiError(401, "Unauthorized"));
    const req = { headers: {}, method: "GET" };
    const res = makeRes();
    await handler(req, res);
    expect(res["statusCode"]).toBe(401);
  });

  it("returns existing affiliate profile with code from affiliate_codes", async () => {
    mockSql
      .mockResolvedValueOnce([{
        id: "aff-1",
        auth_subject_id: "firebase-uid-1",
        display_name: "Alex",
        email: "alex@test.com",
        partner_type: "pt",
        role: "affiliate",
        onboarded: true,
      }])
      .mockResolvedValueOnce([{ code: "ABCD1234" }]);

    const req = { headers: { authorization: "Bearer tok" }, method: "GET" };
    const res = makeRes();
    await handler(req, res);
    expect(res["statusCode"]).toBe(200);
    expect((res["body"] as { referralCode: string }).referralCode).toBe("ABCD1234");
    expect((res["body"] as { role: string }).role).toBe("pt");
    // transaction must NOT have been called for existing affiliate
    expect(mockSql.transaction).not.toHaveBeenCalled();
  });

  it("creates new affiliate on first login via atomic transaction", async () => {
    mockSql.mockResolvedValueOnce([]); // auth_subject_id lookup → not found
    mockSql.transaction.mockResolvedValueOnce([[], [], []]);

    const req = { headers: { authorization: "Bearer tok" }, method: "GET" };
    const res = makeRes();
    await handler(req, res);

    expect(res["statusCode"]).toBe(200);
    const body = res["body"] as { referralCode: string; role: string; onboarded: boolean };
    expect(body.referralCode).toMatch(/^[0-9A-F]{8}$/);
    expect(body.role).toBe("pt");
    expect(body.onboarded).toBe(false);

    // Transaction called once with exactly 3 queries (insert affiliate, insert code, select back)
    expect(mockSql.transaction).toHaveBeenCalledTimes(1);
    expect(mockSql.transaction.mock.calls[0][0]).toHaveLength(3);
  });
});
