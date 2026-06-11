import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql } from "../../../_lib/db";
import { verifyAdminSession, ApiError } from "../../../_lib/auth";

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

    const requestId = req.query.id as string;
    const { note } = (req.body ?? {}) as { note?: string };

    const payoutRows = await sql`
      SELECT id, status, affiliate_id, amount, period
      FROM affiliate_payouts WHERE id = ${requestId}
    `;
    if (payoutRows.length === 0) {
      res.status(404).json({ error: "Payout request not found" });
      return;
    }
    const payout = payoutRows[0] as {
      id: string; status: string; affiliate_id: string; amount: number; period: string;
    };
    if (payout.status === "paid") {
      res.status(409).json({ error: "Already paid" });
      return;
    }

    // Write ledger deduction — idempotency key prevents double-deduction on retry
    await sql`
      INSERT INTO affiliate_ledger_entries
        (affiliate_id, entry_type, amount, idempotency_key, note)
      VALUES (
        ${payout.affiliate_id},
        'payout_deduction',
        ${Number(payout.amount)},
        ${"payout_" + requestId},
        ${note ?? null}
      )
      ON CONFLICT (idempotency_key) DO NOTHING
    `;

    // Mark payout as paid
    const updated = await sql`
      UPDATE affiliate_payouts
      SET status = 'paid', completed_at = NOW(), admin_note = ${note ?? null}
      WHERE id = ${requestId}
      RETURNING id, status, period, completed_at, admin_note
    `;
    const row = updated[0] as {
      id: string; status: string; period: string; completed_at: Date | string; admin_note: string | null;
    };

    res.status(200).json({
      id: row.id,
      status: row.status,
      period: row.period,
      completedAt: row.completed_at instanceof Date ? row.completed_at.toISOString() : String(row.completed_at),
      adminNote: row.admin_note,
    });
  } catch (err) {
    if (err instanceof ApiError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error("/api/admin/payout-requests/[id]/approve error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
