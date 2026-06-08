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
      SELECT id FROM affiliates WHERE firebase_uid = ${user.uid}
    `;
    if (affiliates.length === 0) {
      res.status(404).json({ error: "Affiliate not found" });
      return;
    }
    const affiliateId = (affiliates[0] as { id: string }).id;

    const [wallets, conversions] = await Promise.all([
      sql`SELECT balance, total_earned, total_withdrawn FROM referral_wallets WHERE user_id = ${affiliateId}`,
      sql`
        SELECT status, COUNT(*) as count
        FROM referral_conversions
        WHERE referrer_user_id = ${affiliateId}
        GROUP BY status
      `,
    ]);

    const wallet = (wallets[0] as { balance: number; total_earned: number; total_withdrawn: number }) ?? {
      balance: 0, total_earned: 0, total_withdrawn: 0,
    };

    const convMap = new Map<string, number>();
    for (const row of conversions as { status: string; count: string }[]) {
      convMap.set(row.status, parseInt(row.count, 10));
    }

    const stats: AffiliateStats = {
      balance: wallet.balance,
      totalEarned: wallet.total_earned,
      totalWithdrawn: wallet.total_withdrawn,
      pendingTrials: convMap.get("trial") ?? 0,
      activeSubscriptions: convMap.get("converted") ?? 0,
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
