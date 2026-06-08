// api/admin/[id]/mark-paid.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql } from "../../_lib/db";
import { verifyAuth, ApiError } from "../../_lib/auth";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  try {
    const user = await verifyAuth(req);

    // Check admin role
    const callerRows = await sql`
      SELECT role FROM affiliates WHERE firebase_uid = ${user.uid}
    `;
    if (callerRows.length === 0 || (callerRows[0] as { role: string }).role !== "admin") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const affiliateId = req.query.id as string;
    if (!affiliateId) {
      res.status(400).json({ error: "Missing affiliate id" });
      return;
    }

    // Verify the target affiliate exists
    const target = await sql`SELECT id FROM affiliates WHERE id = ${affiliateId}`;
    if (target.length === 0) {
      res.status(404).json({ error: "Affiliate not found" });
      return;
    }

    await sql`
      UPDATE payout_requests
      SET status = 'paid', completed_at = NOW(), updated_at = NOW()
      WHERE user_id = ${affiliateId} AND status = 'pending'
    `;

    res.status(200).json({ ok: true });
  } catch (err) {
    if (err instanceof ApiError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error("/api/admin/[id]/mark-paid error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
