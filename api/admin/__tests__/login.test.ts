import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../_lib/db", () => ({ sql: vi.fn() }));

import { sql } from "../../_lib/db";

const mockSql = sql as unknown as ReturnType<typeof vi.fn>;

function makeRes() {
  const res = { statusCode: 200, body: "" as unknown } as Record<string, unknown>;
  res["status"] = vi.fn((c: number) => { res["statusCode"] = c; return res; });
  res["json"] = vi.fn((d: unknown) => { res["body"] = d; return res; });
  return res;
}

describe("POST /api/admin/login", () => {
  let handler: typeof import("../../_lib/admin/login").default;

  beforeAll(async () => {
    handler = (await import("../../_lib/admin/login")).default;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 instead of 500 for malformed stored password hashes", async () => {
    mockSql.mockResolvedValueOnce([{
      id: "admin-1",
      name: "Admin",
      email: "admin@test.com",
      role: "admin",
      password_hash: "salt:not-hex",
      onboarded: true,
    }]);

    const res = makeRes();
    await handler({
      method: "POST",
      body: { email: "admin@test.com", password: "secret" },
    } as never, res);

    expect(res["statusCode"]).toBe(401);
    expect((res["body"] as { error: string }).error).toContain("không đúng");
  });
});
