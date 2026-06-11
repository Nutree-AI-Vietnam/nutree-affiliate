import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql } from "../../_lib/db";
import { verifyAdminSession, ApiError } from "../../_lib/auth";
import type { AdminPayoutRequest } from "../../_lib/types";

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

    const rows = await sql`
      SELECT
        p.id, p.affiliate_id, a.display_name AS affiliate_name,
        p.period, p.amount, p.status, p.requested_at, p.completed_at, p.admin_note
      FROM affiliate_payouts p
      JOIN affiliates a ON a.id = p.affiliate_id
      WHERE p.period IS NOT NULL
      ORDER BY
        CASE WHEN p.status = 'pending' THEN 0 ELSE 1 END,
        p.requested_at ASC
    `;

    const requests: AdminPayoutRequest[] = (rows as {
      id: string; affiliate_id: string; affiliate_name: string; period: string;
      amount: number; status: string; requested_at: Date | string;
      completed_at: Date | string | null; admin_note: string | null;
    }[]).map((r) => ({
      id: r.id,
      affiliateId: r.affiliate_id,
      affiliateName: r.affiliate_name,
      period: r.period,
      amount: Number(r.amount),
      status: r.status as "pending" | "paid",
      requestedAt: (r.requested_at instanceof Date ? r.requested_at.toISOString() : String(r.requested_at)),
      completedAt: r.completed_at
        ? (r.completed_at instanceof Date ? r.completed_at.toISOString() : String(r.completed_at))
        : null,
      adminNote: r.admin_note,
    }));

    res.status(200).json(requests);
  } catch (err) {
    if (err instanceof ApiError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error("/api/admin/payout-requests error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
