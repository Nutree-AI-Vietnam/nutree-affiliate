// api/admin/overview.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql } from "../db";
import { verifyAdminSession, ApiError } from "../auth";
import type { AdminOverview, AdminAffiliateRow } from "../types";

const COMMISSION_PER_CONVERSION = 300_000; // VND — mirrors default commission_rules row

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  try {
    verifyAdminSession(req);

    // All affiliate-role partners (excludes admin rows)
    const allAffiliates = await sql`
      SELECT id, display_name AS name, bank_info
      FROM affiliates WHERE role = 'affiliate'
    `;

    // Active codes per affiliate (one per affiliate)
    const activeCodes = await sql`
      SELECT affiliate_id, code FROM affiliate_codes WHERE status = 'active'
    `;
    const codeMap = new Map<string, string>();
    for (const row of activeCodes as { affiliate_id: string; code: string }[]) {
      codeMap.set(row.affiliate_id, row.code);
    }

    // Ledger-derived wallet per affiliate
    const ledger = await sql`
      SELECT
        affiliate_id,
        COALESCE(SUM(CASE WHEN entry_type = 'credit' THEN amount ELSE 0 END), 0) AS total_earned,
        COALESCE(SUM(CASE
          WHEN entry_type = 'credit' THEN amount
          WHEN entry_type IN ('reversal', 'debit', 'payout_deduction') THEN -amount
          ELSE 0
        END), 0) AS balance
      FROM affiliate_ledger_entries GROUP BY affiliate_id
    `;
    const ledgerMap = new Map<string, { total_earned: number; balance: number }>();
    for (const row of ledger as { affiliate_id: string; total_earned: number; balance: number }[]) {
      ledgerMap.set(row.affiliate_id, {
        total_earned: Number(row.total_earned),
        balance: Number(row.balance),
      });
    }

    // Conversion counts per affiliate
    const conversions = await sql`
      SELECT affiliate_id, status, COUNT(*)::int AS count
      FROM affiliate_conversions GROUP BY affiliate_id, status
    `;
    const convMap = new Map<string, { pending: number; active: number }>();
    for (const row of conversions as { affiliate_id: string; status: string; count: string | number }[]) {
      const entry = convMap.get(row.affiliate_id) ?? { pending: 0, active: 0 };
      if (row.status === "trial") entry.pending = Number(row.count);
      else if (row.status === "converted") entry.active = Number(row.count);
      convMap.set(row.affiliate_id, entry);
    }

    // Last paid date per affiliate
    const lastPaid = await sql`
      SELECT affiliate_id, MAX(completed_at) AS last_paid_date
      FROM affiliate_payouts WHERE status = 'paid' GROUP BY affiliate_id
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
    }[]).map((a) => {
      const wallet = ledgerMap.get(a.id) ?? { total_earned: 0, balance: 0 };
      const conv = convMap.get(a.id) ?? { pending: 0, active: 0 };
      return {
        affiliateId: a.id,
        name: a.name,
        code: codeMap.get(a.id) ?? "",
        pendingTrials: conv.pending,
        activeSubscriptions: conv.active,
        totalEarned: wallet.total_earned,
        balance: wallet.balance,
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
    console.error("/api/admin/overview error:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "Internal server error" });
  }
}
