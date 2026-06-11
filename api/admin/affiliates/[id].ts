// api/admin/affiliates/[id].ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql } from "../../_lib/db";
import { verifyAdminSession, ApiError } from "../../_lib/auth";
import type { MonthlyEarning, Conversion, LedgerEntry } from "../../_lib/types";

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

    const affiliateId = req.query.id as string;

    const affiliateRows = await sql`
      SELECT id, display_name, status, bank_info
      FROM affiliates WHERE id = ${affiliateId}
    `;
    if (affiliateRows.length === 0) {
      res.status(404).json({ error: "Affiliate not found" });
      return;
    }
    const aff = affiliateRows[0] as {
      id: string; display_name: string; status: string; bank_info: unknown;
    };

    const codeRows = await sql`
      SELECT code FROM affiliate_codes WHERE affiliate_id = ${affiliateId} AND status = 'active' LIMIT 1
    `;
    const code = (codeRows[0] as { code?: string } | undefined)?.code ?? "";

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

    const payoutRows = await sql`
      SELECT id, period, status FROM affiliate_payouts
      WHERE affiliate_id = ${affiliateId} AND period IS NOT NULL
    `;
    const payoutByMonth = new Map<string, { id: string; status: string }>();
    for (const r of payoutRows as { id: string; period: string; status: string }[]) {
      payoutByMonth.set(r.period, { id: r.id, status: r.status });
    }

    const now = new Date();
    const currentMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

    const monthlyEarnings: MonthlyEarning[] = (ledgerRows as {
      month: string; credits: string | number; reversals: string | number;
    }[]).map((r) => {
      const credits = Number(r.credits);
      const reversals = Number(r.reversals);
      const net = credits - reversals;
      const payout = payoutByMonth.get(r.month);
      let payoutStatus: MonthlyEarning["payoutStatus"];
      if (r.month >= currentMonth) payoutStatus = "accumulating";
      else if (payout?.status === "paid") payoutStatus = "paid";
      else if (payout?.status === "pending") payoutStatus = "pending";
      else if (net > 0) payoutStatus = "unrequested";
      else payoutStatus = "accumulating";
      return { month: r.month, credits, reversals, net, payoutStatus, payoutRequestId: payout?.id ?? null, lockedUntil: null };
    });

    const convRows = await sql`
      SELECT created_at, status FROM affiliate_conversions
      WHERE affiliate_id = ${affiliateId} AND status = 'converted'
      ORDER BY created_at DESC
    `;
    const conversions: Conversion[] = (convRows as { created_at: Date | string; status: string }[]).map((r) => ({
      joinedAt: (r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at)).slice(0, 10),
      status: "converted" as const,
    }));

    const entryRows = await sql`
      SELECT id, entry_type, amount, note, created_at
      FROM affiliate_ledger_entries
      WHERE affiliate_id = ${affiliateId}
      ORDER BY created_at DESC
    `;
    const ledgerEntries: LedgerEntry[] = (entryRows as {
      id: string; entry_type: string; amount: number; note: string | null; created_at: Date | string;
    }[]).map((r) => ({
      id: r.id,
      entryType: r.entry_type,
      amount: Number(r.amount),
      note: r.note,
      createdAt: (r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at)),
    }));

    res.status(200).json({
      affiliateId: aff.id,
      name: aff.display_name,
      code,
      status: aff.status,
      bankInfo: aff.bank_info ?? null,
      monthlyEarnings,
      conversions,
      ledgerEntries,
    });
  } catch (err) {
    if (err instanceof ApiError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error("/api/admin/affiliates/[id] error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
