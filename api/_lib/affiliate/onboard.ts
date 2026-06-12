// api/affiliate/onboard.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql } from "../db";
import { verifyAuth, ApiError } from "../auth";
import type { BankInfo } from "../types";

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

    if (!name?.trim()) {
      res.status(400).json({ error: "Vui lòng nhập họ tên" });
      return;
    }
    const trimmedName = name.trim();

    if (!referralCode?.trim()) {
      res.status(400).json({ error: "Vui lòng nhập mã giới thiệu" });
      return;
    }
    const trimmedCode = referralCode.trim().toUpperCase();
    if (trimmedCode.length > 8 || !/^[A-Z0-9]+$/.test(trimmedCode)) {
      res.status(400).json({ error: "Mã tối đa 8 ký tự, chỉ dùng chữ cái và số" });
      return;
    }

    const affiliateRows = await sql`
      SELECT id FROM affiliates WHERE auth_provider = 'neon' AND auth_subject_id = ${user.uid}
    `;
    if (affiliateRows.length === 0) {
      res.status(404).json({ error: "Affiliate not found" });
      return;
    }
    const affiliateId = (affiliateRows[0] as { id: string }).id;

    // Check code uniqueness in affiliate_codes (case-insensitive)
    const conflict = await sql`
      SELECT id FROM affiliate_codes
      WHERE UPPER(code) = ${trimmedCode} AND status = 'active' AND affiliate_id != ${affiliateId}
    `;
    if (conflict.length > 0) {
      res.status(409).json({ error: "Mã này đã được sử dụng, vui lòng chọn mã khác" });
      return;
    }

    const bankJson = bankInfo?.bankName ? JSON.stringify(bankInfo) : null;

    // Update affiliate profile
    await sql`
      UPDATE affiliates
      SET display_name = ${trimmedName}, name = ${trimmedName},
          bank_info = ${bankJson}, onboarded = true, updated_at = NOW()
      WHERE id = ${affiliateId}
    `;

    // Upsert active code in affiliate_codes
    const existing = await sql`
      SELECT id FROM affiliate_codes WHERE affiliate_id = ${affiliateId} AND status = 'active'
    `;
    if (existing.length > 0) {
      await sql`
        UPDATE affiliate_codes
        SET code = ${trimmedCode}, updated_at = NOW()
        WHERE affiliate_id = ${affiliateId} AND status = 'active'
      `;
    } else {
      await sql`
        INSERT INTO affiliate_codes (affiliate_id, code, status)
        VALUES (${affiliateId}, ${trimmedCode}, 'active')
      `;
    }

    res.status(200).json({ ok: true, name: trimmedName, referralCode: trimmedCode });
  } catch (err) {
    if (err instanceof ApiError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error("/api/affiliate/onboard error:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "Internal server error" });
  }
}
