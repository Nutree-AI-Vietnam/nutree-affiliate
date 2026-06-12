// api/affiliate/me.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql } from "../db";
import { verifyAuth, ApiError } from "../auth";
import type { AffiliateProfile } from "../types";
import { randomBytes, randomUUID } from "crypto";

const APP_STORE_LINK = "https://apps.apple.com/vn/app/nutree-eat-with-science/id6751159552";

function generateCode(): string {
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

    const rows = await sql`
      SELECT id, display_name, email, partner_type, role, onboarded
      FROM affiliates WHERE auth_provider = 'neon' AND auth_subject_id = ${user.uid}
    `;

    if (rows.length > 0) {
      const aff = rows[0] as {
        id: string; display_name: string; email: string;
        partner_type: string | null; role: string; onboarded: boolean;
      };
      const codeRows = await sql`
        SELECT code FROM affiliate_codes
        WHERE affiliate_id = ${aff.id} AND status = 'active'
        ORDER BY created_at LIMIT 1
      `;
      const code = (codeRows[0] as { code: string } | undefined)?.code ?? "";
      const profile: AffiliateProfile = {
        affiliateId: aff.id,
        name: aff.display_name,
        email: aff.email,
        role: aff.partner_type ?? "pt",
        referralCode: code,
        referralLink: APP_STORE_LINK,
        onboarded: aff.onboarded,
      };
      res.status(200).json(profile);
      return;
    }

    // First login — create affiliate + code in one atomic transaction
    const newId = randomUUID();
    const code = generateCode();
    await sql.transaction([
      sql`INSERT INTO affiliates (id, auth_provider, auth_subject_id, email, display_name, partner_type, role, status, onboarded)
          VALUES (${newId}, 'neon', ${user.uid}, ${user.email}, ${user.name}, 'pt', 'affiliate', 'pending', false)`,
      sql`INSERT INTO affiliate_codes (id, affiliate_id, code, status)
          VALUES (${randomUUID()}, ${newId}, ${code}, 'active')`,
      sql`SELECT id FROM affiliates WHERE id = ${newId}`,
    ]);

    const profile: AffiliateProfile = {
      affiliateId: newId,
      name: user.name,
      email: user.email,
      role: "pt",
      referralCode: code,
      referralLink: APP_STORE_LINK,
      onboarded: false,
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
