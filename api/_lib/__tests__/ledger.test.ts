import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../db", () => ({ sql: vi.fn() }));

import { sql } from "../db";
import { insertLedgerEntry } from "../ledger";

const mockSql = sql as unknown as ReturnType<typeof vi.fn>;

describe("insertLedgerEntry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses the idempotent insert when the idempotency constraint exists", async () => {
    mockSql.mockResolvedValueOnce([{ id: "entry-1" }]);

    await expect(insertLedgerEntry(
      "aff-1",
      "credit",
      300000,
      "credit_evt-1",
      "evt-1",
      "subscription_initial_purchase",
      "Commission",
    )).resolves.toBe(true);

    expect(mockSql).toHaveBeenCalledTimes(1);
  });

  it("falls back when production is missing the idempotency conflict constraint", async () => {
    mockSql
      .mockRejectedValueOnce(Object.assign(new Error("missing constraint"), { code: "42P10" }))
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: "entry-1" }]);

    await expect(insertLedgerEntry(
      "aff-1",
      "credit",
      300000,
      "credit_evt-1",
      "evt-1",
      "subscription_initial_purchase",
      "Commission",
    )).resolves.toBe(true);

    expect(mockSql).toHaveBeenCalledTimes(3);
  });

  it("skips duplicate ledger entries during missing-constraint fallback", async () => {
    mockSql
      .mockRejectedValueOnce(Object.assign(new Error("missing constraint"), { code: "42P10" }))
      .mockResolvedValueOnce([{ id: "entry-existing" }]);

    await expect(insertLedgerEntry(
      "aff-1",
      "credit",
      300000,
      "credit_evt-1",
      "evt-1",
      "subscription_initial_purchase",
      "Commission",
    )).resolves.toBe(false);

    expect(mockSql).toHaveBeenCalledTimes(2);
  });
});
