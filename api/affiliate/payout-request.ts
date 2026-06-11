import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql } from "../_lib/db";
import { verifyAuth, ApiError } from "../_lib/auth";

const MONTH_RE = /^\d{4}-\d{2}$/;

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  try {
    const user = await verifyAuth(req);

    const affiliates = await sql`
      SELECT id FROM affiliates WHERE auth_provider = 'neon' AND auth_subject_id = ${user.uid}
    `;
    if (affiliates.length === 0) {
      res.status(404).json({ error: "Affiliate not found" });
      return;
    }
    const affiliateId = (affiliates[0] as { id: string }).id;

    const { month } = req.body as { month?: string };
    if (!month || !MONTH_RE.test(month)) {
      res.status(400).json({ error: "month must be in YYYY-MM format" });
      return;
    }

    const now = new Date();
    const currentMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    if (month >= currentMonth) {
      res.status(400).json({ error: "Can only request payout for past months" });
      return;
    }

    // Compute net earnings for the requested month
    const netRows = await sql`
      SELECT COALESCE(SUM(CASE
        WHEN entry_type = 'credit' THEN amount
        WHEN entry_type = 'reversal' THEN -amount
        ELSE 0
      END), 0) AS net
      FROM affiliate_ledger_entries
      WHERE affiliate_id = ${affiliateId}
        AND TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') = ${month}
    `;
    const net = Number((netRows[0] as { net: string | number }).net);
    if (net <= 0) {
      res.status(400).json({ error: "No positive earnings for this month" });
      return;
    }

    try {
      const inserted = await sql`
        INSERT INTO affiliate_payouts (affiliate_id, amount, status, period, requested_at)
        VALUES (${affiliateId}, ${net}, 'pending', ${month}, NOW())
        RETURNING id, amount, status, period, requested_at
      `;
      const row = inserted[0] as {
        id: string; amount: number; status: string; period: string; requested_at: Date;
      };
      res.status(201).json({
        id: row.id,
        amount: Number(row.amount),
        status: row.status,
        period: row.period,
        requestedAt: (row.requested_at instanceof Date
          ? row.requested_at.toISOString()
          : String(row.requested_at)),
      });
    } catch (dbErr) {
      if ((dbErr as { code?: string }).code === "23505") {
        res.status(409).json({ error: "Payout already requested for this month" });
        return;
      }
      throw dbErr;
    }
  } catch (err) {
    if (err instanceof ApiError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error("/api/affiliate/payout-request error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
