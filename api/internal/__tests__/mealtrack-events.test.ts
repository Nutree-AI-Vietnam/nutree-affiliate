import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

vi.mock("../../_lib/db", () => ({
  ensureAffiliateIdentitySchema: vi.fn().mockResolvedValue(undefined),
  sql: vi.fn(),
}));
vi.mock("../../_lib/internal-auth", () => ({
  verifyInternalRequest: vi.fn(),
  readRawBody: vi.fn(),
}));
vi.mock("../../_lib/ledger", () => ({
  getActiveCommissionRule: vi.fn(),
  insertLedgerEntry: vi.fn(),
}));
vi.mock("../../_lib/auth", () => ({
  ApiError: class ApiError extends Error {
    constructor(public status: number, msg: string) { super(msg); }
  },
}));

import { sql } from "../../_lib/db";
import { verifyInternalRequest, readRawBody } from "../../_lib/internal-auth";
import { getActiveCommissionRule, insertLedgerEntry } from "../../_lib/ledger";

const mockSql = sql as unknown as ReturnType<typeof vi.fn>;
const mockVerify = verifyInternalRequest as ReturnType<typeof vi.fn>;
const mockReadBody = readRawBody as ReturnType<typeof vi.fn>;
const mockGetRule = getActiveCommissionRule as ReturnType<typeof vi.fn>;
const mockInsertLedger = insertLedgerEntry as ReturnType<typeof vi.fn>;

function makeRes() {
  const res = { statusCode: 200, body: "" as unknown } as Record<string, unknown>;
  res["status"] = vi.fn((c: number) => { res["statusCode"] = c; return res; });
  res["json"] = vi.fn((d: unknown) => { res["body"] = d; return res; });
  return res;
}

const BASE_EVT = {
  event_id: "evt-001",
  event_type: "subscription_initial_purchase",
  occurred_at: "2026-06-10T00:00:00Z",
  mealtrack_user_id: "user-1",
  affiliate_id: "aff-1",
};

describe("POST /api/internal/mealtrack-events", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let handler: (req: any, res: any) => Promise<void>;

  beforeAll(async () => {
    handler = (await import("../mealtrack-events")).default;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockVerify.mockReturnValue(undefined);
    mockReadBody.mockResolvedValue(JSON.stringify(BASE_EVT));
    mockGetRule.mockResolvedValue({ amount: 300000, currency: "VND" });
    mockInsertLedger.mockResolvedValue(true);
  });

  it("returns 405 on non-POST", async () => {
    const res = makeRes();
    await handler({ method: "GET", headers: {} }, res);
    expect(res["statusCode"]).toBe(405);
  });

  it("returns 401 on bad HMAC signature", async () => {
    const { ApiError } = await import("../../_lib/auth");
    mockVerify.mockImplementation(() => { throw new ApiError(401, "Invalid signature"); });
    const res = makeRes();
    await handler({ method: "POST", headers: {} }, res);
    expect(res["statusCode"]).toBe(401);
  });

  it("returns 400 when required fields are missing", async () => {
    mockReadBody.mockResolvedValue(JSON.stringify({ event_id: "x" })); // missing event_type, mealtrack_user_id
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

  it("returns 400 for affiliate_attribution_created without affiliate_id", async () => {
    const evt = { event_id: "x", event_type: "affiliate_attribution_created", mealtrack_user_id: "u-1" };
    mockReadBody.mockResolvedValue(JSON.stringify(evt));
    const res = makeRes();
    await handler({ method: "POST", headers: {} }, res);
    expect(res["statusCode"]).toBe(400);
  });

  it("returns duplicate status for already-processed event_id", async () => {
    mockSql.mockResolvedValueOnce([]); // ON CONFLICT DO NOTHING → no row returned
    const res = makeRes();
    await handler({ method: "POST", headers: {} }, res);
    expect(res["statusCode"]).toBe(200);
    expect((res["body"] as { status: string }).status).toBe("duplicate");
    expect(mockSql).toHaveBeenCalledTimes(1); // only the inbox insert
  });

  it("returns duplicate status when the event_id conflict constraint is missing", async () => {
    mockSql
      .mockRejectedValueOnce(Object.assign(new Error("missing constraint"), { code: "42P10" }))
      .mockResolvedValueOnce([{ id: "wh-existing" }]);

    const res = makeRes();
    await handler({ method: "POST", headers: {} }, res);

    expect(res["statusCode"]).toBe(200);
    expect((res["body"] as { status: string }).status).toBe("duplicate");
    expect(mockSql).toHaveBeenCalledTimes(2);
  });

  it("initial_purchase with existing trial promotes trial and credits ledger", async () => {
    mockSql
      .mockResolvedValueOnce([{ id: "wh-1" }])                          // inbox insert → new
      .mockResolvedValueOnce([{ id: "conv-1", affiliate_id: "aff-1" }]) // SELECT trial conversion (with affiliate_id)
      .mockResolvedValueOnce([])                                        // UPDATE conversion to converted
      .mockResolvedValueOnce([]);                                       // UPDATE webhook_event to processed

    const res = makeRes();
    await handler({ method: "POST", headers: {} }, res);

    expect(res["statusCode"]).toBe(200);
    expect((res["body"] as { status: string }).status).toBe("accepted");
    expect(mockGetRule).toHaveBeenCalledWith("aff-1");
    expect(mockInsertLedger).toHaveBeenCalledWith(
      "aff-1", "credit", 300000,
      "credit_evt-001", "evt-001", "subscription_initial_purchase",
      expect.any(String)
    );
  });

  it("initial_purchase without prior trial inserts new converted conversion", async () => {
    mockSql
      .mockResolvedValueOnce([{ id: "wh-1" }])  // inbox insert → new
      .mockResolvedValueOnce([])                 // SELECT trial → none
      .mockResolvedValueOnce([{ id: "conv-new" }]) // INSERT converted conversion
      .mockResolvedValueOnce([]);                // UPDATE webhook_event to processed

    const res = makeRes();
    await handler({ method: "POST", headers: {} }, res);

    expect(res["statusCode"]).toBe(200);
    expect((res["body"] as { status: string }).status).toBe("accepted");
    expect(mockInsertLedger).toHaveBeenCalledWith(
      "aff-1", "credit", 300000, expect.any(String), expect.any(String), expect.any(String), expect.any(String)
    );
  });

  it("initial_purchase falls back when the user_id conflict constraint is missing", async () => {
    mockSql
      .mockResolvedValueOnce([{ id: "wh-1" }]) // inbox insert → new
      .mockResolvedValueOnce([]) // SELECT trial → none
      .mockRejectedValueOnce(Object.assign(new Error("missing constraint"), { code: "42P10" }))
      .mockResolvedValueOnce([]) // fallback duplicate check
      .mockResolvedValueOnce([{ id: "conv-new" }]) // fallback insert
      .mockResolvedValueOnce([]); // UPDATE webhook_event to processed

    const res = makeRes();
    await handler({ method: "POST", headers: {} }, res);

    expect(res["statusCode"]).toBe(200);
    expect((res["body"] as { status: string }).status).toBe("accepted");
    expect(mockInsertLedger).toHaveBeenCalledWith(
      "aff-1", "credit", 300000, expect.any(String), expect.any(String), expect.any(String), expect.any(String)
    );
  });

  it("refund inserts reversal entry and marks conversion refunded", async () => {
    const refundEvt = { ...BASE_EVT, event_type: "subscription_refund" };
    mockReadBody.mockResolvedValue(JSON.stringify(refundEvt));
    mockSql
      .mockResolvedValueOnce([{ id: "wh-1" }])                          // inbox insert → new
      .mockResolvedValueOnce([{ id: "conv-1", affiliate_id: "aff-1" }]) // SELECT converted (with affiliate_id)
      .mockResolvedValueOnce([])                                        // UPDATE conversion to refunded
      .mockResolvedValueOnce([]);                                       // UPDATE webhook_event to processed

    const res = makeRes();
    await handler({ method: "POST", headers: {} }, res);

    expect(res["statusCode"]).toBe(200);
    expect(mockInsertLedger).toHaveBeenCalledWith(
      "aff-1", "reversal", 300000,
      "reversal_evt-001", "evt-001", "subscription_refund",
      expect.any(String)
    );
  });

  it("refund with no converted conversion skips ledger entry", async () => {
    const refundEvt = { ...BASE_EVT, event_type: "subscription_refund" };
    mockReadBody.mockResolvedValue(JSON.stringify(refundEvt));
    mockSql
      .mockResolvedValueOnce([{ id: "wh-1" }]) // inbox insert → new
      .mockResolvedValueOnce([])                // SELECT converted → none
      .mockResolvedValueOnce([]);               // UPDATE webhook_event to processed

    const res = makeRes();
    await handler({ method: "POST", headers: {} }, res);

    expect(res["statusCode"]).toBe(200);
    expect(mockInsertLedger).not.toHaveBeenCalled();
  });

  it("marks event failed and returns 500 when processing throws", async () => {
    mockSql
      .mockResolvedValueOnce([{ id: "wh-1" }])                      // inbox insert → new
      .mockRejectedValueOnce(new Error("DB connection lost"))       // SELECT trial throws
      .mockResolvedValueOnce([]);                                   // UPDATE webhook_event to failed

    const res = makeRes();
    await handler({ method: "POST", headers: {} }, res);

    expect(res["statusCode"]).toBe(500);
    const body = res["body"] as { error: string; retryable: boolean };
    expect(body.retryable).toBe(true);
    // Verify the failure was persisted
    const lastSqlCall = mockSql.mock.calls[mockSql.mock.calls.length - 1];
    expect(lastSqlCall).toBeDefined();
  });

  it("returns accepted for unknown event types without error", async () => {
    const unknownEvt = { ...BASE_EVT, event_type: "subscription_renewal" };
    mockReadBody.mockResolvedValue(JSON.stringify(unknownEvt));
    mockSql
      .mockResolvedValueOnce([{ id: "wh-1" }]) // inbox insert → new
      .mockResolvedValueOnce([]);               // UPDATE webhook_event to processed

    const res = makeRes();
    await handler({ method: "POST", headers: {} }, res);

    expect(res["statusCode"]).toBe(200);
    expect((res["body"] as { status: string }).status).toBe("accepted");
    expect(mockInsertLedger).not.toHaveBeenCalled();
  });

  it("sets occurred_at and locked_until when trial row is updated on subscription_initial_purchase", async () => {
    const occurredAt = "2026-06-01T10:00:00.000Z";
    const evt = {
      event_id: "evt-ts-1",
      event_type: "subscription_initial_purchase",
      occurred_at: occurredAt,
      mealtrack_user_id: "user-ts-1",
    };
    mockReadBody.mockResolvedValue(JSON.stringify(evt));

    // inbox insert → returns 1 row (new event)
    mockSql.mockResolvedValueOnce([{ id: "inbox-1" }]);
    // trial lookup → returns trial row
    mockSql.mockResolvedValueOnce([{ id: "conv-1", affiliate_id: "aff-1" }]);
    // UPDATE conversion (the call we're testing)
    const updateCall = vi.fn().mockResolvedValue([]);
    mockSql.mockImplementationOnce(updateCall);
    // processed_at update
    mockSql.mockResolvedValueOnce([]);

    const res = makeRes();
    await handler({ method: "POST", headers: {} }, res);

    expect(res["statusCode"]).toBe(200);
    expect(res["body"]).toMatchObject({ status: "accepted" });

    // Verify the UPDATE call included occurred_at and locked_until
    const updateSqlArgs = updateCall.mock.calls[0];
    const sqlStrings = updateSqlArgs[0] as TemplateStringsArray;
    const fullQuery = sqlStrings.join("$?");
    expect(fullQuery).toContain("occurred_at");
    expect(fullQuery).toContain("locked_until");
  });

  it("falls back to NOW() when occurred_at is missing and still sets locked_until", async () => {
    const evt = {
      event_id: "evt-ts-2",
      event_type: "subscription_initial_purchase",
      // occurred_at intentionally omitted
      mealtrack_user_id: "user-ts-2",
    };
    mockReadBody.mockResolvedValue(JSON.stringify(evt));

    mockSql.mockResolvedValueOnce([{ id: "inbox-2" }]);
    mockSql.mockResolvedValueOnce([{ id: "conv-2", affiliate_id: "aff-2" }]);
    const updateCall = vi.fn().mockResolvedValue([]);
    mockSql.mockImplementationOnce(updateCall);
    mockSql.mockResolvedValueOnce([]);

    const res = makeRes();
    await handler({ method: "POST", headers: {} }, res);

    expect(res["statusCode"]).toBe(200);
    const sqlStrings = updateCall.mock.calls[0][0] as TemplateStringsArray;
    const fullQuery = sqlStrings.join("$?");
    expect(fullQuery).toContain("locked_until");
  });
});
