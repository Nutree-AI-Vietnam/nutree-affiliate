import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql } from "../_lib/db";
import { verifyAuth, ApiError } from "../_lib/auth";
import type { AffiliateProfile } from "../_lib/types";
import { randomBytes } from "crypto";

function generateReferralCode(): string {
  return randomBytes(4).toString("hex").toUpperCase();
}

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

    let rows = await sql`
      SELECT id, name, email, role, referral_code FROM affiliates WHERE firebase_uid = ${user.uid}
    `;

    if (rows.length === 0) {
      // First login — create affiliate record (self-contained, no users FK needed)
      let code = generateReferralCode();
      // Retry once on collision
      try {
        await sql`
          INSERT INTO affiliates (id, firebase_uid, name, email, role, referral_code, balance, total_earned, total_withdrawn, pending_trials, active_subscriptions)
          VALUES (gen_random_uuid(), ${user.uid}, ${user.name}, ${user.email}, 'pt', ${code}, 0, 0, 0, 0, 0)
        `;
      } catch {
        code = generateReferralCode();
        await sql`
          INSERT INTO affiliates (id, firebase_uid, name, email, role, referral_code, balance, total_earned, total_withdrawn, pending_trials, active_subscriptions)
          VALUES (gen_random_uuid(), ${user.uid}, ${user.name}, ${user.email}, 'pt', ${code}, 0, 0, 0, 0, 0)
        `;
      }
      rows = await sql`SELECT id, name, email, role, referral_code FROM affiliates WHERE firebase_uid = ${user.uid}`;
    }

    const aff = rows[0] as { id: string; name: string; email: string; role: string; referral_code: string };
    const profile: AffiliateProfile = {
      affiliateId: aff.id,
      name: aff.name,
      email: aff.email,
      role: aff.role,
      referralCode: aff.referral_code,
      referralLink: `https://nutree.app/r/${aff.referral_code}`,
    };

    res.status(200).json(profile);
  } catch (err) {
    if (err instanceof ApiError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error("/api/affiliate/me error:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "Internal server error" });
  }
}
