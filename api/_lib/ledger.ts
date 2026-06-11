// api/_lib/ledger.ts
import { sql } from "./db";

export interface CommissionRule {
  amount: number;
  currency: string;
}

/**
 * Look up the applicable commission rule for an affiliate.
 * Checks affiliate-specific overrides first, then falls back to the default rule.
 */
export async function getActiveCommissionRule(affiliateId?: string): Promise<CommissionRule> {
  if (affiliateId) {
    const override = await sql`
      SELECT amount, currency FROM commission_rules
      WHERE affiliate_id = ${affiliateId} AND is_active = true
      ORDER BY created_at DESC LIMIT 1
    `;
    if (override.length > 0) {
      const r = override[0] as { amount: number; currency: string };
      return { amount: Number(r.amount), currency: r.currency };
    }
  }

  const rows = await sql`
    SELECT amount, currency FROM commission_rules
    WHERE is_default = true AND is_active = true
    ORDER BY created_at DESC LIMIT 1
  `;
  if (rows.length === 0) return { amount: 300000, currency: "VND" };
  const r = rows[0] as { amount: number; currency: string };
  return { amount: Number(r.amount), currency: r.currency };
}

/**
 * Insert a ledger entry, skipping silently on idempotency key collision.
 * Returns true if a new row was inserted, false if it was a duplicate.
 */
export async function insertLedgerEntry(
  affiliateId: string,
  entryType: "credit" | "reversal" | "debit" | "payout_deduction",
  amount: number,
  idempotencyKey: string,
  referenceId: string,
  referenceType: string,
  note: string
): Promise<boolean> {
  const result = await sql`
    INSERT INTO affiliate_ledger_entries
      (affiliate_id, entry_type, amount, idempotency_key, reference_id, reference_type, note)
    VALUES (${affiliateId}, ${entryType}, ${amount}, ${idempotencyKey}, ${referenceId}, ${referenceType}, ${note})
    ON CONFLICT (idempotency_key) DO NOTHING
    RETURNING id
  `;
  return result.length > 0;
}
