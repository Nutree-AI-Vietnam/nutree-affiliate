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

    // Get all PT affiliates with their referral codes and wallets
    const allAffiliates = await sql`
      SELECT a.id, a.name, a.bank_info,
             rc.code,
             rw.balance, rw.total_earned
      FROM affiliates a
      LEFT JOIN referral_codes rc ON rc.user_id = a.id
      LEFT JOIN referral_wallets rw ON rw.user_id = a.id
      WHERE a.role = 'pt'
    `;

    // Get conversion counts per affiliate
    const [conversionCounts, lastPaid] = await Promise.all([
      sql`
        SELECT referrer_user_id, status, COUNT(*) as count
        FROM referral_conversions
        GROUP BY referrer_user_id, status
      `,
      sql`
        SELECT user_id, MAX(completed_at) as last_paid_date
        FROM payout_requests
        WHERE status = 'paid'
        GROUP BY user_id
      `,
    ]);

    const lastPaidMap = new Map<string, string>();
    for (const row of lastPaid as { user_id: string; last_paid_date: Date | null }[]) {
      if (row.last_paid_date) {
        const d = row.last_paid_date instanceof Date ? row.last_paid_date : new Date(String(row.last_paid_date));
        lastPaidMap.set(row.user_id, d.toISOString().slice(0, 10));
      }
    }

    const convMap = new Map<string, Map<string, number>>();
    for (const row of conversionCounts as { referrer_user_id: string; status: string; count: string }[]) {
      if (!convMap.has(row.referrer_user_id)) convMap.set(row.referrer_user_id, new Map());
      convMap.get(row.referrer_user_id)!.set(row.status, parseInt(row.count, 10));
    }

    const rows: AdminAffiliateRow[] = (allAffiliates as {
      id: string; name: string; bank_info: unknown;
      code: string | null; balance: number | null; total_earned: number | null;
    }[]).map((a) => {
      const convs = convMap.get(a.id) ?? new Map();
      return {
        affiliateId: a.id,
        name: a.name,
        code: a.code ?? "",
        pendingTrials: convs.get("trial") ?? 0,
        activeSubscriptions: convs.get("converted") ?? 0,
        totalEarned: a.total_earned ?? 0,
        balance: a.balance ?? 0,
        hasBankInfo: !!a.bank_info,
        lastPaidDate: lastPaidMap.get(a.id) ?? null,
      };
    });

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
