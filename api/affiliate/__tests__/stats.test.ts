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
  res["status"] = vi.fn((c: number) => { res["statusCode"] = c; return res; });
  res["json"] = vi.fn((d: unknown) => { res["body"] = d; return res; });
  return res;
}

describe("GET /api/affiliate/stats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyAuth.mockResolvedValue({ uid: "fb-uid", name: "Alex", email: "a@test.com" });
  });

  it("returns 404 if affiliate not found", async () => {
    mockSql.mockResolvedValueOnce([]);
    const handler = (await import("../stats")).default;
    const req = { headers: { authorization: "Bearer tok" }, method: "GET" } as never;
    const res = makeRes();
    await handler(req, res as never);
    expect(res["statusCode"]).toBe(404);
  });

  it("returns stats with wallet and conversion counts", async () => {
    mockSql
      .mockResolvedValueOnce([{ id: "aff-1" }])
      .mockResolvedValueOnce([{ balance: 600000, total_earned: 900000, total_withdrawn: 300000 }])
      .mockResolvedValueOnce([{ status: "trial", count: "2" }, { status: "active", count: "3" }]);

    const handler = (await import("../stats")).default;
    const req = { headers: { authorization: "Bearer tok" }, method: "GET" } as never;
    const res = makeRes();
    await handler(req, res as never);
    expect(res["statusCode"]).toBe(200);
    const body = res["body"] as { balance: number; pendingTrials: number; activeSubscriptions: number };
    expect(body.balance).toBe(600000);
    expect(body.pendingTrials).toBe(2);
    expect(body.activeSubscriptions).toBe(3);
  });
});
