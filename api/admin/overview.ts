// api/admin/overview.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql } from "../_lib/db";
import { verifyAuth, ApiError } from "../_lib/auth";
import type { AdminOverview, AdminAffiliateRow } from "../_lib/types";

const COMMISSION_PER_CONVERSION = 300_000; // VND

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

    // Check admin role
    const callerRows = await sql`
      SELECT role FROM affiliates WHERE firebase_uid = ${user.uid}
    `;
    if (callerRows.length === 0 || (callerRows[0] as { role: string }).role !== "admin") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    // All PT affiliates — fully self-contained in affiliates table
    const allAffiliates = await sql`
      SELECT id, name, bank_info, referral_code,
             balance, total_earned, pending_trials, active_subscriptions
      FROM affiliates
      WHERE role = 'pt'
    `;

    // Last paid date per affiliate
    const lastPaid = await sql`
      SELECT affiliate_id, MAX(completed_at) as last_paid_date
      FROM affiliate_payouts
      WHERE status = 'paid'
      GROUP BY affiliate_id
    `;

    const lastPaidMap = new Map<string, string>();
    for (const row of lastPaid as { affiliate_id: string; last_paid_date: Date | null }[]) {
      if (row.last_paid_date) {
        const d = row.last_paid_date instanceof Date ? row.last_paid_date : new Date(String(row.last_paid_date));
        lastPaidMap.set(row.affiliate_id, d.toISOString().slice(0, 10));
      }
    }

    const rows: AdminAffiliateRow[] = (allAffiliates as {
      id: string; name: string; bank_info: unknown;
      referral_code: string | null; balance: number; total_earned: number;
      pending_trials: number; active_subscriptions: number;
    }[]).map((a) => ({
      affiliateId: a.id,
      name: a.name,
      code: a.referral_code ?? "",
      pendingTrials: a.pending_trials,
      activeSubscriptions: a.active_subscriptions,
      totalEarned: Number(a.total_earned),
      balance: Number(a.balance),
      hasBankInfo: !!a.bank_info,
      lastPaidDate: lastPaidMap.get(a.id) ?? null,
    }));

    const overview: AdminOverview = {
      totalRevenue: rows.reduce((s, r) => s + r.totalEarned, 0),
      totalPayoutOwed: rows.reduce((s, r) => s + r.balance, 0),
      activeAffiliates: rows.length,
      commissionPerConversion: COMMISSION_PER_CONVERSION,
      affiliates: rows,
    };

    res.status(200).json(overview);
  } catch (err) {
    if (err instanceof ApiError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error("/api/admin/overview error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
