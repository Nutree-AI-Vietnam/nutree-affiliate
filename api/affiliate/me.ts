import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql } from "../_lib/db";
import { verifyAuth, ApiError } from "../_lib/auth";
import type { AffiliateProfile } from "../_lib/types";
import { randomBytes, randomUUID } from "crypto";

function generateReferralCode(): string {
  return randomBytes(4).toString("hex").toUpperCase();
}

async function createAffiliate(
  uid: string,
  name: string,
  email: string
): Promise<{ affiliateId: string; code: string }> {
  // Check for an existing users row first (for Nutree app users who become affiliates)
  const userRows = await sql`SELECT id FROM users WHERE firebase_uid = ${uid}`;
  let affiliateId: string;

  if (userRows.length > 0) {
    affiliateId = (userRows[0] as { id: string }).id;
  } else {
    // Check if a users row exists for this email (Nutree app user logging into affiliate portal)
    const emailRows = await sql`SELECT id FROM users WHERE email = ${email}`;
    if (emailRows.length > 0) {
      affiliateId = (emailRows[0] as { id: string }).id;
      // Link their firebase_uid so future lookups by uid work
      await sql`UPDATE users SET firebase_uid = ${uid} WHERE id = ${affiliateId}`;
    } else {
      // Brand new user — create a stub users row so FK constraints are satisfied
      affiliateId = randomUUID();
      const username = `aff_${email.split("@")[0]}_${randomBytes(3).toString("hex")}`;
      await sql`
        INSERT INTO users (id, firebase_uid, email, username, password_hash, provider, is_active, onboarding_completed, last_accessed, created_at, updated_at)
        VALUES (${affiliateId}, ${uid}, ${email}, ${username}, 'AFFILIATE_GOOGLE_AUTH', 'GOOGLE', true, false, NOW(), NOW(), NOW())
        ON CONFLICT (email) DO UPDATE SET firebase_uid = ${uid}
        RETURNING id
      `;
      // Re-fetch in case ON CONFLICT fired (another row with same email existed)
      const refetch = await sql`SELECT id FROM users WHERE email = ${email}`;
      affiliateId = (refetch[0] as { id: string }).id;
    }
  }

  const code = generateReferralCode();

  await sql.transaction([
    sql`
      INSERT INTO affiliates (id, firebase_uid, name, email, role)
      VALUES (${affiliateId}, ${uid}, ${name}, ${email}, 'pt')
    `,
    sql`
      INSERT INTO referral_codes (user_id, code, created_at)
      VALUES (${affiliateId}, ${code}, NOW())
    `,
    sql`
      INSERT INTO referral_wallets (user_id, balance, total_earned, total_revoked, total_withdrawn, updated_at)
      VALUES (${affiliateId}, 0, 0, 0, 0, NOW())
    `,
  ]);

  return { affiliateId, code };
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
    const rows = await sql`
      SELECT id, name, email, role FROM affiliates WHERE firebase_uid = ${user.uid}
    `;

    let affiliateId: string;
    let name: string;
    let email: string;
    let role: string;
    let code: string;

    if (rows.length === 0) {
      const created = await createAffiliate(user.uid, user.name, user.email);
      affiliateId = created.affiliateId;
      name = user.name;
      email = user.email;
      role = "pt";
      code = created.code;
    } else {
      const aff = rows[0] as { id: string; name: string; email: string; role: string };
      affiliateId = aff.id;
      name = aff.name;
      email = aff.email;
      role = aff.role;
      const codes = await sql`SELECT code FROM referral_codes WHERE user_id = ${affiliateId}`;
      code = (codes[0] as { code: string })?.code ?? "";
    }

    const profile: AffiliateProfile = {
      affiliateId,
      name,
      email,
      role,
      referralCode: code,
      referralLink: `https://nutree.app/r/${code}`,
    };

    res.status(200).json(profile);
  } catch (err) {
    if (err instanceof ApiError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error("/api/affiliate/me error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
