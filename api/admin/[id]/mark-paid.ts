// api/admin/[id]/mark-paid.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql } from "../../_lib/db";
import { verifyAdminSession, ApiError } from "../../_lib/auth";
import { randomUUID } from "crypto";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  try {
    verifyAdminSession(req);

    const affiliateId = req.query.id as string;
    if (!affiliateId) {
      res.status(400).json({ error: "Missing affiliate id" });
      return;
    }

    const target = await sql`SELECT id FROM affiliates WHERE id = ${affiliateId}`;
    if (target.length === 0) {
      res.status(404).json({ error: "Affiliate not found" });
      return;
    }

    // Calculate current balance from ledger
    const walletRows = await sql`
      SELECT COALESCE(SUM(CASE
        WHEN entry_type = 'credit' THEN amount
        WHEN entry_type IN ('reversal', 'debit', 'payout_deduction') THEN -amount
        ELSE 0
      END), 0) AS balance
      FROM affiliate_ledger_entries WHERE affiliate_id = ${affiliateId}
    `;
    const balance = Number((walletRows[0] as { balance: number }).balance);

    if (balance <= 0) {
      res.status(400).json({ error: "No balance to pay out" });
      return;
    }

    const note = (req.body as { note?: string } | undefined)?.note ?? null;
    const payoutId = randomUUID();
    const idempotencyKey = `payout_${payoutId}`;

    await sql.transaction([
      sql`INSERT INTO affiliate_payouts (id, affiliate_id, amount, status, admin_note, completed_at)
          VALUES (${payoutId}, ${affiliateId}, ${balance}, 'paid', ${note}, NOW())`,
      sql`INSERT INTO affiliate_ledger_entries
            (affiliate_id, entry_type, amount, idempotency_key, reference_id, reference_type, note)
          VALUES (${affiliateId}, 'payout_deduction', ${balance}, ${idempotencyKey},
                  ${payoutId}, 'affiliate_payout', ${note ?? "Admin mark-paid"})`,
    ]);

    res.status(200).json({ ok: true });
  } catch (err) {
    if (err instanceof ApiError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error("/api/admin/[id]/mark-paid error:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "Internal server error" });
  }
}
