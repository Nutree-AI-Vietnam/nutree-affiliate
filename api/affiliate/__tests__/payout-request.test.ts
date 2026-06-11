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

const mockSql = sql as unknown as ReturnType<typeof vi.fn>;
const mockVerifyAuth = verifyAuth as ReturnType<typeof vi.fn>;

function makeRes() {
  const res = { statusCode: 200, body: "" as unknown } as Record<string, unknown>;
  res["status"] = vi.fn((c: number) => { res["statusCode"] = c; return res; });
  res["json"] = vi.fn((d: unknown) => { res["body"] = d; return res; });
  return res;
}

describe("POST /api/affiliate/payout-request", () => {
  let handler: (req: unknown, res: unknown) => Promise<void>;

  beforeAll(async () => {
    handler = (await import("../payout-request")).default;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyAuth.mockResolvedValue({ uid: "fb-uid", name: "Alex", email: "a@test.com" });
  });

  it("returns 405 for non-POST", async () => {
    const req = { headers: {}, method: "GET", body: {} };
    const res = makeRes();
    await handler(req, res);
    expect(res["statusCode"]).toBe(405);
  });

  it("returns 400 if month format is invalid", async () => {
    mockSql.mockResolvedValueOnce([{ id: "aff-1" }]);
    const req = { headers: { authorization: "Bearer tok" }, method: "POST", body: { month: "06-2026" } };
    const res = makeRes();
    await handler(req, res);
    expect(res["statusCode"]).toBe(400);
  });

  it("returns 400 if month is current or future", async () => {
    mockSql.mockResolvedValueOnce([{ id: "aff-1" }]);
    const now = new Date();
    const currentMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    const req = { headers: { authorization: "Bearer tok" }, method: "POST", body: { month: currentMonth } };
    const res = makeRes();
    await handler(req, res);
    expect(res["statusCode"]).toBe(400);
  });

  it("returns 409 if payout request already exists for that month", async () => {
    mockSql
      .mockResolvedValueOnce([{ id: "aff-1" }])
      .mockResolvedValueOnce([{ latest_locked: null }])
      .mockResolvedValueOnce([{ credits_m: "300000", reversals_m: "0" }])
      .mockResolvedValueOnce([{ overall_balance: "300000" }])
      .mockRejectedValueOnce(Object.assign(new Error("unique"), { code: "23505" }));
    const req = {
      headers: { authorization: "Bearer tok" }, method: "POST",
      body: { month: "2026-05" },
    };
    const res = makeRes();
    await handler(req, res);
    expect(res["statusCode"]).toBe(409);
  });

  it("creates payout request and returns it", async () => {
    mockSql
      .mockResolvedValueOnce([{ id: "aff-1" }])
      .mockResolvedValueOnce([{ latest_locked: null }])
      .mockResolvedValueOnce([{ credits_m: "300000", reversals_m: "0" }])
      .mockResolvedValueOnce([{ overall_balance: "300000" }])
      .mockResolvedValueOnce([{
        id: "req-new", amount: 300000, status: "pending", period: "2026-05",
        requested_at: new Date("2026-06-01T00:00:00Z"),
      }]);
    const req = {
      headers: { authorization: "Bearer tok" }, method: "POST",
      body: { month: "2026-05" },
    };
    const res = makeRes();
    await handler(req, res);
    expect(res["statusCode"]).toBe(201);
    const body = res["body"] as { id: string; status: string; period: string };
    expect(body.id).toBe("req-new");
    expect(body.status).toBe("pending");
    expect(body.period).toBe("2026-05");
  });

  it("returns 422 when the month still has locked conversions", async () => {
    const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
    mockSql
      .mockResolvedValueOnce([{ id: "aff-1" }])
      .mockResolvedValueOnce([{ latest_locked: futureDate }]);

    const req = {
      headers: { authorization: "Bearer tok" }, method: "POST",
      body: { month: "2026-05" },
    };
    const res = makeRes();
    await handler(req, res);

    expect(res["statusCode"]).toBe(422);
    const body = res["body"] as { error: string; lockedUntil: string };
    expect(body.error).toContain("giữ tiền");
    expect(body.lockedUntil).toBe(futureDate);
  });

  it("returns 422 when overall balance is negative (carry-over debt exceeds monthly earnings)", async () => {
    mockSql
      .mockResolvedValueOnce([{ id: "aff-1" }])
      .mockResolvedValueOnce([{ latest_locked: null }])
      .mockResolvedValueOnce([{ credits_m: "300000", reversals_m: "0" }])
      .mockResolvedValueOnce([{ overall_balance: "-100000" }]);

    const req = {
      headers: { authorization: "Bearer tok" }, method: "POST",
      body: { month: "2026-05" },
    };
    const res = makeRes();
    await handler(req, res);

    expect(res["statusCode"]).toBe(422);
    const body = res["body"] as { error: string };
    expect(body.error).toContain("hoàn tiền");
  });

  it("creates payout request with carry-over-reduced amount when balance < monthly net", async () => {
    mockSql
      .mockResolvedValueOnce([{ id: "aff-1" }])
      .mockResolvedValueOnce([{ latest_locked: null }])
      .mockResolvedValueOnce([{ credits_m: "300000", reversals_m: "0" }])
      .mockResolvedValueOnce([{ overall_balance: "200000" }])
      .mockResolvedValueOnce([{
        id: "req-new", amount: 200000, status: "pending", period: "2026-05",
        requested_at: new Date("2026-06-01T00:00:00Z"),
      }]);

    const req = {
      headers: { authorization: "Bearer tok" }, method: "POST",
      body: { month: "2026-05" },
    };
    const res = makeRes();
    await handler(req, res);

    expect(res["statusCode"]).toBe(201);
    const body = res["body"] as { amount: number };
    expect(body.amount).toBe(200000);
  });
});
