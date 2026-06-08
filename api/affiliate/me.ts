import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql } from "../_lib/db";
import { verifyAuth, ApiError } from "../_lib/auth";
import type { AffiliateProfile } from "../_lib/types";
import { randomUUID, randomBytes } from "crypto";

function generateReferralCode(): string {
  return randomBytes(4).toString("hex").toUpperCase();
}

async function createAffiliate(
  uid: string,
  name: string,
  email: string
): Promise<{ affiliateId: string; code: string }> {
  const affiliateId = randomUUID();
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
