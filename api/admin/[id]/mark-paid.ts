// api/admin/[id]/mark-paid.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql } from "../../_lib/db";
import { verifyAdminSession, ApiError } from "../../_lib/auth";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  try {
    verifyAdminSession(req);

    const affiliateId = req.query.id as string;
    if (!affiliateId) {
      res.status(400).json({ error: "Missing affiliate id" });
      return;
    }

    const target = await sql`SELECT id, balance FROM affiliates WHERE id = ${affiliateId}`;
    if (target.length === 0) {
      res.status(404).json({ error: "Affiliate not found" });
      return;
    }

    const note = (req.body as { note?: string } | undefined)?.note ?? null;
    const balance = Number((target[0] as { balance: number }).balance);

    if (balance <= 0) {
      res.status(400).json({ error: "No balance to pay out" });
      return;
    }

    // Record the payout and reset balance
    await sql`
      INSERT INTO affiliate_payouts (affiliate_id, amount, status, admin_note, completed_at)
      VALUES (${affiliateId}, ${balance}, 'paid', ${note}, NOW())
    `;
    await sql`
      UPDATE affiliates
      SET total_withdrawn = total_withdrawn + ${balance}, balance = 0, updated_at = NOW()
      WHERE id = ${affiliateId}
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
