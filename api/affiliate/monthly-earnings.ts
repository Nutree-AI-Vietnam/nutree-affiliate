// api/affiliate/monthly-earnings.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql } from "../_lib/db";
import { verifyAuth, ApiError } from "../_lib/auth";
import type { MonthlyEarning } from "../_lib/types";

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

    // Monthly credit/reversal breakdown from ledger
    const ledgerRows = await sql`
      SELECT
        TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month,
        COALESCE(SUM(CASE WHEN entry_type = 'credit' THEN amount ELSE 0 END), 0) AS credits,
        COALESCE(SUM(CASE WHEN entry_type = 'reversal' THEN amount ELSE 0 END), 0) AS reversals
      FROM affiliate_ledger_entries
      WHERE affiliate_id = ${affiliateId}
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY DATE_TRUNC('month', created_at) DESC
    `;

    // Payout requests for this affiliate — index by period
    const payoutRows = await sql`
      SELECT id, period, status
      FROM affiliate_payouts
      WHERE affiliate_id = ${affiliateId}
        AND period IS NOT NULL
    `;
    const payoutByMonth = new Map<string, { id: string; status: string }>();
    for (const r of payoutRows as { id: string; period: string; status: string }[]) {
      payoutByMonth.set(r.period, { id: r.id, status: r.status });
    }

    // Current UTC calendar month — cannot be requested
    const now = new Date();
    const currentMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

    const earnings: MonthlyEarning[] = (ledgerRows as {
      month: string; credits: string | number; reversals: string | number;
    }[]).map((r) => {
      const credits = Number(r.credits);
      const reversals = Number(r.reversals);
      const net = credits - reversals;
      const payout = payoutByMonth.get(r.month);

      let payoutStatus: MonthlyEarning["payoutStatus"];
      if (r.month >= currentMonth) {
        payoutStatus = "accumulating";
      } else if (payout?.status === "paid") {
        payoutStatus = "paid";
      } else if (payout?.status === "pending") {
        payoutStatus = "pending";
      } else if (net > 0) {
        payoutStatus = "unrequested";
      } else {
        payoutStatus = "accumulating"; // zero net past month — nothing to request
      }

      return {
        month: r.month,
        credits,
        reversals,
        net,
        payoutStatus,
        payoutRequestId: payout?.id ?? null,
        lockedUntil: null,
      };
    });

    res.status(200).json(earnings);
  } catch (err) {
    if (err instanceof ApiError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error("/api/affiliate/monthly-earnings error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
