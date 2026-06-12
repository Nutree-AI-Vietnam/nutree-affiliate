import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql } from "../db";
import { verifyAuth, ApiError } from "../auth";

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

    // Lock gate: any credit in the requested month still within holding period?
    const lockRows = await sql`
      SELECT MAX(ac.locked_until) AS latest_locked
      FROM affiliate_ledger_entries le
      JOIN affiliate_conversions ac ON ac.event_id = le.reference_id
      WHERE le.affiliate_id = ${affiliateId}
        AND le.entry_type = 'credit'
        AND TO_CHAR(DATE_TRUNC('month', le.created_at), 'YYYY-MM') = ${month}
        AND ac.locked_until > NOW()
    `;
    const latestLocked = (lockRows[0] as { latest_locked: Date | string | null }).latest_locked;
    if (latestLocked) {
      const lockedUntil = latestLocked instanceof Date
        ? latestLocked.toISOString()
        : String(latestLocked);
      res.status(422).json({
        error: "Tháng này chưa hết thời gian giữ tiền",
        lockedUntil,
      });
      return;
    }

    // Carry-over-aware payout amount:
    //   net_M       = credits_M - reversals_M  (this month's net earnings)
    //   overall_bal = credits - reversals - payout_deductions  (all time)
    //   payout_amount = max(0, min(net_M, overall_bal))
    const monthlyRows = await sql`
      SELECT
        COALESCE(SUM(CASE WHEN entry_type = 'credit' THEN amount ELSE 0 END), 0) AS credits_m,
        COALESCE(SUM(CASE WHEN entry_type = 'reversal' THEN amount ELSE 0 END), 0) AS reversals_m
      FROM affiliate_ledger_entries
      WHERE affiliate_id = ${affiliateId}
        AND TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') = ${month}
    `;
    const creditsM = Number((monthlyRows[0] as { credits_m: string | number }).credits_m);
    const reversalsM = Number((monthlyRows[0] as { reversals_m: string | number }).reversals_m);
    const netM = creditsM - reversalsM;

    const balanceRows = await sql`
      SELECT COALESCE(SUM(CASE
        WHEN entry_type = 'credit' THEN amount
        WHEN entry_type IN ('reversal', 'debit', 'payout_deduction') THEN -amount
        ELSE 0
      END), 0)
      - COALESCE((
          SELECT SUM(amount) FROM affiliate_payouts
          WHERE affiliate_id = ${affiliateId} AND status = 'pending'
        ), 0) AS overall_balance
      FROM affiliate_ledger_entries
      WHERE affiliate_id = ${affiliateId}
    `;
    const overallBalance = Number((balanceRows[0] as { overall_balance: string | number }).overall_balance);

    const payoutAmount = Math.max(0, Math.min(netM, overallBalance));
    if (payoutAmount <= 0) {
      res.status(422).json({ error: "Hoa hồng tháng này chưa đủ bù khoản hoàn tiền trước đó." });
      return;
    }

    try {
      const inserted = await sql`
        INSERT INTO affiliate_payouts (affiliate_id, amount, status, period, requested_at)
        VALUES (${affiliateId}, ${payoutAmount}, 'pending', ${month}, NOW())
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
