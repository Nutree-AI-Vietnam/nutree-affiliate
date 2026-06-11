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

describe("GET /api/affiliate/stats", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let handler: (req: any, res: any) => Promise<void>;

  beforeAll(async () => {
    handler = (await import("../stats")).default;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyAuth.mockResolvedValue({ uid: "fb-uid", name: "Alex", email: "a@test.com" });
  });

  it("returns 404 if affiliate not found", async () => {
    mockSql.mockResolvedValueOnce([]); // auth_subject_id lookup → not found
    const req = { headers: { authorization: "Bearer tok" }, method: "GET" };
    const res = makeRes();
    await handler(req, res);
    expect(res["statusCode"]).toBe(404);
  });

  it("returns ledger-derived wallet and conversion counts", async () => {
    mockSql
      .mockResolvedValueOnce([{ id: "aff-1" }]) // affiliate id lookup
      .mockResolvedValueOnce([{ balance: 600000, total_earned: 900000, total_withdrawn: 300000 }]) // ledger aggregation
      .mockResolvedValueOnce([{ status: "trial", count: "2" }, { status: "converted", count: "3" }]) // conversion counts
      .mockResolvedValueOnce([{ completed_at: new Date("2026-05-03T00:00:00Z") }]); // latest paid payout

    const req = { headers: { authorization: "Bearer tok" }, method: "GET" };
    const res = makeRes();
    await handler(req, res);

    expect(res["statusCode"]).toBe(200);
    const body = res["body"] as {
      balance: number; totalEarned: number; totalWithdrawn: number;
      pendingTrials: number; activeSubscriptions: number;
    };
    expect(body.balance).toBe(600000);
    expect(body.totalEarned).toBe(900000);
    expect(body.totalWithdrawn).toBe(300000);
    expect(body.pendingTrials).toBe(2);
    expect(body.activeSubscriptions).toBe(3);
    expect((body as { lastPaidDate: string | null }).lastPaidDate).toBe("2026-05-03");
  });

  it("returns zero counts when no conversions exist", async () => {
    mockSql
      .mockResolvedValueOnce([{ id: "aff-1" }])
      .mockResolvedValueOnce([{ balance: 0, total_earned: 0, total_withdrawn: 0 }])
      .mockResolvedValueOnce([]) // no conversion rows
      .mockResolvedValueOnce([]); // no paid payouts

    const req = { headers: { authorization: "Bearer tok" }, method: "GET" };
    const res = makeRes();
    await handler(req, res);

    expect(res["statusCode"]).toBe(200);
    const body = res["body"] as { pendingTrials: number; activeSubscriptions: number };
    expect(body.pendingTrials).toBe(0);
    expect(body.activeSubscriptions).toBe(0);
  });
});
