// api/affiliate/onboard.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql } from "../_lib/db";
import { verifyAuth, ApiError } from "../_lib/auth";
import type { BankInfo } from "../_lib/types";

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
    const { name, referralCode, bankInfo } = req.body as {
      name?: string;
      referralCode?: string;
      bankInfo?: BankInfo;
    };

    if (!name || !name.trim()) {
      res.status(400).json({ error: "Vui lòng nhập họ tên" });
      return;
    }
    const trimmedName = name.trim();

    if (!referralCode || !referralCode.trim()) {
      res.status(400).json({ error: "Vui lòng nhập mã giới thiệu" });
      return;
    }
    const trimmedCode = referralCode.trim().toUpperCase();
    if (trimmedCode.length > 8 || !/^[A-Z0-9]+$/.test(trimmedCode)) {
      res.status(400).json({ error: "Mã tối đa 8 ký tự, chỉ dùng chữ cái và số" });
      return;
    }

    // Check code uniqueness
    const rows = await sql`SELECT id FROM affiliates WHERE firebase_uid = ${user.uid}`;
    if (rows.length === 0) {
      res.status(404).json({ error: "Affiliate not found" });
      return;
    }
    const affiliateId = (rows[0] as { id: string }).id;

    const conflict = await sql`
      SELECT id FROM affiliates WHERE referral_code = ${trimmedCode} AND id != ${affiliateId}
    `;
    if (conflict.length > 0) {
      res.status(409).json({ error: "Mã này đã được sử dụng, vui lòng chọn mã khác" });
      return;
    }

    // Save — bank info is optional
    const bankJson = bankInfo?.bankName ? JSON.stringify(bankInfo) : null;
    await sql`
      UPDATE affiliates
      SET name = ${trimmedName},
          referral_code = ${trimmedCode},
          bank_info = ${bankJson},
          onboarded = true,
          updated_at = NOW()
      WHERE id = ${affiliateId}
    `;

    res.status(200).json({ ok: true, name: trimmedName, referralCode: trimmedCode });
  } catch (err) {
    if (err instanceof ApiError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error("/api/affiliate/onboard error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
