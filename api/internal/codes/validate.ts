// api/internal/codes/validate.ts
// Private endpoint for MealTrack to validate affiliate codes without DB access.
// Auth: HMAC-SHA256 via X-Timestamp + X-Signature headers.
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql } from "../../_lib/db";
import { ApiError } from "../../_lib/auth";
import { verifyInternalRequest, readRawBody } from "../../_lib/internal-auth";

export const config = { api: { bodyParser: false } };

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  try {
    const rawBody = await readRawBody(req);
    verifyInternalRequest(req, rawBody);

    const body = JSON.parse(rawBody) as { code?: unknown };
    if (!body.code || typeof body.code !== "string") {
      res.status(400).json({ error: "code is required" });
      return;
    }
    const normalizedCode = body.code.trim().toUpperCase();

    const rows = await sql`
      SELECT
        c.id         AS code_id,
        c.affiliate_id,
        a.display_name,
        a.partner_type,
        a.status     AS affiliate_status
      FROM affiliate_codes c
      JOIN affiliates a ON a.id = c.affiliate_id
      WHERE UPPER(c.code) = ${normalizedCode} AND c.status = 'active'
      LIMIT 1
    `;

    if (rows.length === 0) {
      res.status(200).json({ active: false });
      return;
    }

    const row = rows[0] as {
      code_id: string;
      affiliate_id: string;
      display_name: string;
      partner_type: string | null;
      affiliate_status: string;
    };

    // Suspended or pending affiliates must not receive new attribution
    if (row.affiliate_status !== "active") {
      res.status(200).json({ active: false });
      return;
    }

    res.status(200).json({
      active: true,
      affiliateId: row.affiliate_id,
      codeId: row.code_id,
      displayName: row.display_name,
      partnerType: row.partner_type,
    });
  } catch (err) {
    if (err instanceof ApiError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error("/api/internal/codes/validate error:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "Internal server error" });
  }
}
