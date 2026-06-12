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

describe("GET /api/admin/affiliates/:id", () => {
  let handler: typeof import("../../_lib/admin/affiliate-detail").default;

  beforeAll(async () => {
    handler = (await import("../../_lib/admin/affiliate-detail")).default;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyAdminSession.mockReturnValue({ affiliateId: "admin-1" });
  });

  it("returns 404 if affiliate not found", async () => {
    mockSql.mockResolvedValueOnce([]);
    const req = { headers: { authorization: "Bearer admin.x.y" }, method: "GET", query: { id: "aff-999" } };
    const res = makeRes();
    await handler(req, res);
    expect(res["statusCode"]).toBe(404);
  });

  it("returns full affiliate detail", async () => {
    mockSql
      .mockResolvedValueOnce([{
        id: "aff-1", display_name: "Alex", status: "active",
        bank_info: { bankName: "VCB", accountHolder: "ALEX", accountNumber: "1234" },
      }])
      .mockResolvedValueOnce([{ code: "ALEX01" }])
      .mockResolvedValueOnce([
        { month: "2026-05", credits: "300000", reversals: "0" },
      ])
      .mockResolvedValueOnce([])   // locked_until rows
      .mockResolvedValueOnce([])   // payout requests
      .mockResolvedValueOnce([    // conversions
        { created_at: new Date("2026-05-01"), status: "converted" },
      ])
      .mockResolvedValueOnce([    // ledger entries
        { id: "led-1", entry_type: "credit", amount: "300000", note: null, created_at: new Date("2026-05-01") },
      ]);

    const req = { headers: { authorization: "Bearer admin.x.y" }, method: "GET", query: { id: "aff-1" } };
    const res = makeRes();
    await handler(req, res);

    expect(res["statusCode"]).toBe(200);
    const body = res["body"] as {
      affiliateId: string; name: string; code: string; status: string;
      bankInfo: unknown; monthlyEarnings: unknown[]; conversions: unknown[]; ledgerEntries: unknown[];
    };
    expect(body.affiliateId).toBe("aff-1");
    expect(body.code).toBe("ALEX01");
    expect(body.bankInfo).toMatchObject({ bankName: "VCB" });
    expect(body.monthlyEarnings).toHaveLength(1);
    expect(body.conversions).toHaveLength(1);
    expect(body.ledgerEntries).toHaveLength(1);
  });
});
