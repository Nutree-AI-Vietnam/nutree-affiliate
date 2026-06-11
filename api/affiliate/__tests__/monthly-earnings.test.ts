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

describe("GET /api/affiliate/monthly-earnings", () => {
  let handler: (req: unknown, res: unknown) => Promise<void>;

  beforeAll(async () => {
    handler = (await import("../monthly-earnings")).default;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyAuth.mockResolvedValue({ uid: "fb-uid", name: "Alex", email: "a@test.com" });
  });

  it("returns 404 if affiliate not found", async () => {
    mockSql.mockResolvedValueOnce([]);
    const req = { headers: { authorization: "Bearer tok" }, method: "GET" };
    const res = makeRes();
    await handler(req, res);
    expect(res["statusCode"]).toBe(404);
  });

  it("maps ledger rows to monthly earnings with payout status", async () => {
    mockSql
      .mockResolvedValueOnce([{ id: "aff-1" }])  // affiliate lookup
      .mockResolvedValueOnce([                    // ledger aggregation
        { month: "2026-04", credits: "300000", reversals: "0" },
        { month: "2026-05", credits: "600000", reversals: "300000" },
      ])
      .mockResolvedValueOnce([])                  // locked_until lookup — no locks
      .mockResolvedValueOnce([                    // payout requests
        { id: "req-1", period: "2026-04", status: "paid" },
      ]);

    const req = { headers: { authorization: "Bearer tok" }, method: "GET" };
    const res = makeRes();
    await handler(req, res);

    expect(res["statusCode"]).toBe(200);
    const body = res["body"] as {
      month: string; credits: number; reversals: number; net: number;
      payoutStatus: string; payoutRequestId: string | null;
    }[];
    expect(body).toHaveLength(2);
    const apr = body.find((m) => m.month === "2026-04")!;
    expect(apr.credits).toBe(300000);
    expect(apr.net).toBe(300000);
    expect(apr.payoutStatus).toBe("paid");
    expect(apr.payoutRequestId).toBe("req-1");

    const may = body.find((m) => m.month === "2026-05")!;
    expect(may.net).toBe(300000); // 600000 - 300000
    // May is a past month with net > 0 and no payout request → unrequested
    expect(may.payoutStatus).toBe("unrequested");
  });

  it("returns locked status when a conversion for the month is still within holding period", async () => {
    const futureDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
    mockSql
      .mockResolvedValueOnce([{ id: "aff-1" }])
      .mockResolvedValueOnce([
        { month: "2026-05", credits: "300000", reversals: "0" },
      ])
      .mockResolvedValueOnce([
        { month: "2026-05", latest_locked_until: futureDate },
      ])
      .mockResolvedValueOnce([]);

    const req = { headers: { authorization: "Bearer tok" }, method: "GET" };
    const res = makeRes();
    await handler(req, res);

    expect(res["statusCode"]).toBe(200);
    const body = res["body"] as { month: string; payoutStatus: string; lockedUntil: string | null }[];
    const may = body.find((m) => m.month === "2026-05")!;
    expect(may.payoutStatus).toBe("locked");
    expect(may.lockedUntil).toBe(futureDate);
  });

  it("returns unrequested when all conversions for the month have passed holding period", async () => {
    mockSql
      .mockResolvedValueOnce([{ id: "aff-1" }])
      .mockResolvedValueOnce([
        { month: "2026-04", credits: "300000", reversals: "0" },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const req = { headers: { authorization: "Bearer tok" }, method: "GET" };
    const res = makeRes();
    await handler(req, res);

    expect(res["statusCode"]).toBe(200);
    const body = res["body"] as { month: string; payoutStatus: string; lockedUntil: string | null }[];
    const apr = body.find((m) => m.month === "2026-04")!;
    expect(apr.payoutStatus).toBe("unrequested");
    expect(apr.lockedUntil).toBeNull();
  });
});
