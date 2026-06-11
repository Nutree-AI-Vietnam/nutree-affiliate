// api/affiliate/stats.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql } from "../_lib/db";
import { verifyAuth, ApiError } from "../_lib/auth";
import type { AffiliateStats } from "../_lib/types";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (req.method !== "GET") {
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

    // Derive wallet from ledger — single aggregation query
    const walletRows = await sql`
      SELECT
        COALESCE(SUM(CASE WHEN entry_type = 'credit' THEN amount ELSE 0 END), 0) AS total_earned,
        COALESCE(SUM(CASE WHEN entry_type = 'payout_deduction' THEN amount ELSE 0 END), 0) AS total_withdrawn,
        COALESCE(SUM(CASE
          WHEN entry_type = 'credit' THEN amount
          WHEN entry_type IN ('reversal', 'debit', 'payout_deduction') THEN -amount
          ELSE 0
        END), 0) AS balance
      FROM affiliate_ledger_entries WHERE affiliate_id = ${affiliateId}
    `;
    const wallet = walletRows[0] as {
      total_earned: number; total_withdrawn: number; balance: number;
    };

    // Conversion counts grouped by status
    const convRows = await sql`
      SELECT status, COUNT(*)::int AS count
      FROM affiliate_conversions WHERE affiliate_id = ${affiliateId} GROUP BY status
    `;

    let pendingTrials = 0;
    let activeSubscriptions = 0;
    for (const row of convRows as { status: string; count: string | number }[]) {
      const n = Number(row.count);
      if (row.status === "trial") pendingTrials = n;
      else if (row.status === "converted") activeSubscriptions = n;
    }

    const lastPaidRows = await sql`
      SELECT completed_at
      FROM affiliate_payouts
      WHERE affiliate_id = ${affiliateId}
        AND status = 'paid'
        AND completed_at IS NOT NULL
      ORDER BY completed_at DESC
      LIMIT 1
    `;
    const lastPaid = lastPaidRows[0] as { completed_at?: Date | string } | undefined;

    const stats: AffiliateStats = {
      balance: Number(wallet.balance),
      totalEarned: Number(wallet.total_earned),
      totalWithdrawn: Number(wallet.total_withdrawn),
      pendingTrials,
      activeSubscriptions,
      lastPaidDate: lastPaid?.completed_at instanceof Date
        ? lastPaid.completed_at.toISOString().slice(0, 10)
        : lastPaid?.completed_at
          ? String(lastPaid.completed_at).slice(0, 10)
          : null,
    };
    res.status(200).json(stats);
  } catch (err) {
    if (err instanceof ApiError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error("/api/affiliate/stats error:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "Internal server error" });
  }
}
