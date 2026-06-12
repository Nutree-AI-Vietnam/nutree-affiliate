import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

vi.mock("../../_lib/db", () => ({ sql: vi.fn() }));
vi.mock("../../_lib/auth", () => ({
  verifyAdminSession: vi.fn(),
  ApiError: class ApiError extends Error {
    constructor(public status: number, msg: string) { super(msg); }
  },
}));

import { sql } from "../../_lib/db";
import { verifyAdminSession } from "../../_lib/auth";

const mockSql = sql as unknown as ReturnType<typeof vi.fn>;
const mockVerifyAdminSession = verifyAdminSession as ReturnType<typeof vi.fn>;

function makeRes() {
  const res = { statusCode: 200, body: "" as unknown } as Record<string, unknown>;
  res["status"] = vi.fn((c: number) => { res["statusCode"] = c; return res; });
  res["json"] = vi.fn((d: unknown) => { res["body"] = d; return res; });
  return res;
}

describe("GET /api/admin/payout-requests", () => {
  let handler: typeof import("../../_lib/admin/payout-requests").default;

  beforeAll(async () => {
    handler = (await import("../../_lib/admin/payout-requests")).default;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyAdminSession.mockReturnValue({ affiliateId: "admin-1" });
  });

  it("returns pending requests first then paid", async () => {
    mockSql.mockResolvedValueOnce([
      { id: "req-1", affiliate_id: "aff-1", affiliate_name: "Alex", period: "2026-05",
        amount: "300000", status: "pending", requested_at: new Date("2026-06-01"), completed_at: null, admin_note: null },
      { id: "req-2", affiliate_id: "aff-2", affiliate_name: "Bob", period: "2026-04",
        amount: "600000", status: "paid", requested_at: new Date("2026-05-01"), completed_at: new Date("2026-05-15"), admin_note: "Done" },
    ]);

    const req = { headers: { authorization: "Bearer admin.x.y" }, method: "GET" };
    const res = makeRes();
    await handler(req, res);

    expect(res["statusCode"]).toBe(200);
    const body = res["body"] as { id: string; status: string }[];
    expect(body).toHaveLength(2);
    expect(body[0].status).toBe("pending");
    expect(body[1].status).toBe("paid");
  });

  it("returns empty array when no requests", async () => {
    mockSql.mockResolvedValueOnce([]);
    const req = { headers: { authorization: "Bearer admin.x.y" }, method: "GET" };
    const res = makeRes();
    await handler(req, res);
    expect(res["statusCode"]).toBe(200);
    expect(res["body"]).toEqual([]);
  });
});
