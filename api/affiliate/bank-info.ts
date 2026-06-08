// api/affiliate/bank-info.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql } from "../_lib/db";
import { verifyAuth, ApiError } from "../_lib/auth";
import type { BankInfo } from "../_lib/types";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (req.method !== "GET" && req.method !== "POST") {
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

    if (req.method === "GET") {
      const rows = await sql`
        SELECT bank_info FROM affiliates WHERE id = ${affiliateId}
      `;
      const bankInfo = (rows[0] as { bank_info: BankInfo | null }).bank_info;
      res.status(200).json(bankInfo);
      return;
    }

    // POST — save bank info
    const body = req.body as BankInfo;
    if (!body?.bankName || !body?.accountHolder || !body?.accountNumber) {
      res.status(400).json({ error: "bankName, accountHolder, and accountNumber are required" });
      return;
    }
    const bankInfo: BankInfo = {
      bankName: body.bankName,
      accountHolder: body.accountHolder,
      accountNumber: body.accountNumber,
      ...(body.routingOrSwift ? { routingOrSwift: body.routingOrSwift } : {}),
    };
    await sql`
      UPDATE affiliates
      SET bank_info = ${JSON.stringify(bankInfo)}, updated_at = NOW()
      WHERE id = ${affiliateId}
    `;
    res.status(200).json(bankInfo);
  } catch (err) {
    if (err instanceof ApiError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error("/api/affiliate/bank-info error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
