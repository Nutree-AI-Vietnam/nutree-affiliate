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

    const rows = await sql`
      SELECT balance, total_earned, total_withdrawn, pending_trials, active_subscriptions
      FROM affiliates WHERE firebase_uid = ${user.uid}
    `;
    if (rows.length === 0) {
      res.status(404).json({ error: "Affiliate not found" });
      return;
    }

    const aff = rows[0] as {
      balance: number;
      total_earned: number;
      total_withdrawn: number;
      pending_trials: number;
      active_subscriptions: number;
    };

    const stats: AffiliateStats = {
      balance: Number(aff.balance),
      totalEarned: Number(aff.total_earned),
      totalWithdrawn: Number(aff.total_withdrawn),
      pendingTrials: aff.pending_trials,
      activeSubscriptions: aff.active_subscriptions,
    };

    res.status(200).json(stats);
  } catch (err) {
    if (err instanceof ApiError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error("/api/affiliate/stats error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
