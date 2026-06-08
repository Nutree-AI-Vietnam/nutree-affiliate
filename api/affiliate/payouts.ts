// api/affiliate/payouts.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql } from "../_lib/db";
import { verifyAuth, ApiError } from "../_lib/auth";
import type { PayoutRequest } from "../_lib/types";

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
      SELECT id FROM affiliates WHERE firebase_uid = ${user.uid}
    `;
    if (affiliates.length === 0) {
      res.status(404).json({ error: "Affiliate not found" });
      return;
    }
    const affiliateId = (affiliates[0] as { id: string }).id;

    const rows = await sql`
      SELECT id, amount, status, payment_method, payment_details,
             requested_at, completed_at, admin_note
      FROM payout_requests
      WHERE user_id = ${affiliateId}
      ORDER BY requested_at DESC
    `;

    const payouts: PayoutRequest[] = (rows as {
      id: string;
      amount: number;
      status: string;
      payment_method: string | null;
      payment_details: Record<string, string> | null;
      requested_at: Date;
      completed_at: Date | null;
      admin_note: string | null;
    }[]).map((r) => ({
      id: r.id,
      amount: r.amount,
      status: r.status,
      paymentMethod: r.payment_method,
      paymentDetails: r.payment_details,
      requestedAt: r.requested_at instanceof Date ? r.requested_at.toISOString() : String(r.requested_at),
      completedAt: r.completed_at instanceof Date ? r.completed_at.toISOString() : r.completed_at ? String(r.completed_at) : null,
      adminNote: r.admin_note,
    }));

    res.status(200).json(payouts);
  } catch (err) {
    if (err instanceof ApiError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error("/api/affiliate/payouts error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
