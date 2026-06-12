import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

vi.mock("../../_lib/db", () => ({
  ensureAffiliateIdentitySchema: vi.fn().mockResolvedValue(undefined),
  sql: vi.fn(),
}));
vi.mock("../../_lib/internal-auth", () => ({
  verifyInternalRequest: vi.fn(),
  readRawBody: vi.fn(),
}));
vi.mock("../../_lib/auth", () => ({
  ApiError: class ApiError extends Error {
    constructor(public status: number, msg: string) { super(msg); }
  },
}));

import { sql } from "../../_lib/db";
import { verifyInternalRequest, readRawBody } from "../../_lib/internal-auth";

const mockSql = sql as unknown as ReturnType<typeof vi.fn>;
const mockVerify = verifyInternalRequest as ReturnType<typeof vi.fn>;
const mockReadBody = readRawBody as ReturnType<typeof vi.fn>;

function makeRes() {
  const res = { statusCode: 200, body: "" as unknown } as Record<string, unknown>;
  res["status"] = vi.fn((c: number) => { res["statusCode"] = c; return res; });
  res["json"] = vi.fn((d: unknown) => { res["body"] = d; return res; });
  return res;
}

describe("POST /api/internal/codes/validate", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let handler: (req: any, res: any) => Promise<void>;

  beforeAll(async () => {
    handler = (await import("../codes/validate")).default;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockVerify.mockReturnValue(undefined); // pass by default
    mockReadBody.mockResolvedValue(JSON.stringify({ code: "ABC123" }));
  });

  it("returns 405 on non-POST", async () => {
    const res = makeRes();
    await handler({ method: "GET", headers: {} }, res);
    expect(res["statusCode"]).toBe(405);
  });

  it("returns 401 on bad signature", async () => {
    const { ApiError } = await import("../../_lib/auth");
    mockVerify.mockImplementation(() => { throw new ApiError(401, "Invalid signature"); });
    const res = makeRes();
    await handler({ method: "POST", headers: {} }, res);
    expect(res["statusCode"]).toBe(401);
    expect((res["body"] as { error: string }).error).toContain("signature");
  });

  it("returns 400 when code is missing", async () => {
    mockReadBody.mockResolvedValue(JSON.stringify({}));
    const res = makeRes();
    await handler({ method: "POST", headers: {} }, res);
    expect(res["statusCode"]).toBe(400);
  });

  it("returns 400 when JSON body is malformed", async () => {
    mockReadBody.mockResolvedValue("{bad-json");
    const res = makeRes();
    await handler({ method: "POST", headers: {} }, res);
    expect(res["statusCode"]).toBe(400);
    expect((res["body"] as { error: string }).error).toContain("Invalid JSON");
  });

  it("returns active:false for non-existent code", async () => {
    mockSql.mockResolvedValueOnce([]); // no rows
    const res = makeRes();
    await handler({ method: "POST", headers: {} }, res);
    expect(res["statusCode"]).toBe(200);
    expect((res["body"] as { active: boolean }).active).toBe(false);
  });

  it("returns active:false when affiliate is suspended", async () => {
    mockSql.mockResolvedValueOnce([{
      code_id: "code-1", affiliate_id: "aff-1",
      display_name: "Alex", partner_type: "pt",
      affiliate_status: "suspended",
    }]);
    const res = makeRes();
    await handler({ method: "POST", headers: {} }, res);
    expect(res["statusCode"]).toBe(200);
    expect((res["body"] as { active: boolean }).active).toBe(false);
  });

  it("returns full active response for valid active affiliate code", async () => {
    mockSql.mockResolvedValueOnce([{
      code_id: "code-1", affiliate_id: "aff-1",
      display_name: "Alex", partner_type: "pt",
      affiliate_status: "active",
    }]);
    const res = makeRes();
    await handler({ method: "POST", headers: {} }, res);
    expect(res["statusCode"]).toBe(200);
    const body = res["body"] as {
      active: boolean; affiliateId: string; codeId: string;
      displayName: string; partnerType: string;
    };
    expect(body.active).toBe(true);
    expect(body.affiliateId).toBe("aff-1");
    expect(body.codeId).toBe("code-1");
    expect(body.displayName).toBe("Alex");
    expect(body.partnerType).toBe("pt");
  });
});
