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

describe("POST /api/admin/payout-requests/:id/approve", () => {
  let handler: (req: unknown, res: unknown) => Promise<void>;

  beforeAll(async () => {
    handler = (await import("../payout-requests/[id]/approve")).default;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyAdminSession.mockReturnValue({ affiliateId: "admin-1" });
  });

  it("returns 404 if request not found", async () => {
    mockSql.mockResolvedValueOnce([]);
    const req = { headers: { authorization: "Bearer admin.x.y" }, method: "POST",
      query: { id: "req-999" }, body: {} };
    const res = makeRes();
    await handler(req, res);
    expect(res["statusCode"]).toBe(404);
  });

  it("returns 409 if already paid", async () => {
    mockSql.mockResolvedValueOnce([{ id: "req-1", status: "paid", affiliate_id: "aff-1", amount: "300000", period: "2026-05" }]);
    const req = { headers: { authorization: "Bearer admin.x.y" }, method: "POST",
      query: { id: "req-1" }, body: {} };
    const res = makeRes();
    await handler(req, res);
    expect(res["statusCode"]).toBe(409);
  });

  it("approves and writes ledger deduction", async () => {
    mockSql
      .mockResolvedValueOnce([{ id: "req-1", status: "pending", affiliate_id: "aff-1", amount: "300000", period: "2026-05" }])
      .mockResolvedValueOnce([])  // insert ledger entry
      .mockResolvedValueOnce([{ id: "req-1", status: "paid", period: "2026-05", completed_at: new Date(), admin_note: null }]); // update payout

    const req = { headers: { authorization: "Bearer admin.x.y" }, method: "POST",
      query: { id: "req-1" }, body: { note: "Paid via bank transfer" } };
    const res = makeRes();
    await handler(req, res);

    expect(res["statusCode"]).toBe(200);
    const body = res["body"] as { status: string; period: string };
    expect(body.status).toBe("paid");
    expect(body.period).toBe("2026-05");
  });
});
