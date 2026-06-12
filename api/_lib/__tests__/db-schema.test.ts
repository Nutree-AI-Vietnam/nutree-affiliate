import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockState = vi.hoisted(() => ({
  queries: [] as string[],
}));

vi.mock("@neondatabase/serverless", () => ({
  neon: vi.fn(() => (strings: TemplateStringsArray) => {
    mockState.queries.push(strings.join("${}"));
    return Promise.resolve([]);
  }),
}));

describe("ensureAffiliateIdentitySchema", () => {
  beforeEach(() => {
    vi.resetModules();
    mockState.queries.length = 0;
    process.env.DATABASE_URL = "postgres://user:pass@example.test/neondb";
  });

  afterEach(() => {
    delete process.env.DATABASE_URL;
  });

  it("aligns legacy affiliate and stats schema for Neon runtime", async () => {
    const { ensureAffiliateIdentitySchema } = await import("../db");

    await ensureAffiliateIdentitySchema();

    expect(mockState.queries).toContain(
      "ALTER TABLE affiliates ALTER COLUMN firebase_uid DROP NOT NULL",
    );
    expect(mockState.queries).toContain(
      "ALTER TABLE affiliates ALTER COLUMN referral_code DROP NOT NULL",
    );
    expect(mockState.queries).toContain(
      "ALTER TABLE affiliates ALTER COLUMN name SET DEFAULT ''",
    );
    expect(
      mockState.queries.some((query) =>
        query.includes("CREATE TABLE IF NOT EXISTS affiliate_ledger_entries"),
      ),
    ).toBe(true);
    expect(
      mockState.queries.some((query) =>
        query.includes("CREATE TABLE IF NOT EXISTS affiliate_conversions"),
      ),
    ).toBe(true);
    expect(
      mockState.queries.some((query) =>
        query.includes("CREATE TABLE IF NOT EXISTS affiliate_payouts"),
      ),
    ).toBe(true);
    expect(
      mockState.queries.some((query) =>
        query.includes(
          "ALTER TABLE affiliate_ledger_entries ADD COLUMN IF NOT EXISTS entry_type",
        ),
      ),
    ).toBe(true);
    expect(
      mockState.queries.some((query) =>
        query.includes(
          "ALTER TABLE affiliate_ledger_entries ADD COLUMN IF NOT EXISTS amount",
        ),
      ),
    ).toBe(true);
    expect(
      mockState.queries.some((query) =>
        query.includes(
          "ALTER TABLE affiliate_conversions ADD COLUMN IF NOT EXISTS status",
        ),
      ),
    ).toBe(true);
    expect(
      mockState.queries.some((query) =>
        query.includes(
          "ALTER TABLE affiliate_payouts ADD COLUMN IF NOT EXISTS completed_at",
        ),
      ),
    ).toBe(true);
    expect(
      mockState.queries.some((query) =>
        query.includes("uq_affiliate_payouts_period"),
      ),
    ).toBe(false);
    expect(
      mockState.queries.some((query) =>
        query.includes("uq_affiliate_conversions_user_id"),
      ),
    ).toBe(false);
  });
});
