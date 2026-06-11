// api/affiliate/conversions.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql } from "../_lib/db";
import { verifyAuth, ApiError } from "../_lib/auth";
import type { Conversion } from "../_lib/types";

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
      SELECT id FROM affiliates WHERE auth_provider = 'neon' AND auth_subject_id = ${user.uid}
    `;
    if (affiliates.length === 0) {
      res.status(404).json({ error: "Affiliate not found" });
      return;
    }
    const affiliateId = (affiliates[0] as { id: string }).id;

    const rows = await sql`
      SELECT created_at, status
      FROM affiliate_conversions
      WHERE affiliate_id = ${affiliateId}
        AND status = 'converted'
      ORDER BY created_at DESC
    `;

    const conversions: Conversion[] = (rows as {
      created_at: Date | string;
      status: string;
    }[]).map((r) => ({
      joinedAt: (r.created_at instanceof Date
        ? r.created_at.toISOString()
        : String(r.created_at)).slice(0, 10),
      status: "converted" as const,
    }));

    res.status(200).json(conversions);
  } catch (err) {
    if (err instanceof ApiError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error("/api/affiliate/conversions error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
