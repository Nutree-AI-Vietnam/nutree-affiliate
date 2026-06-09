// api/affiliate/referral-code.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql } from "../_lib/db";
import { verifyAuth, ApiError } from "../_lib/auth";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (req.method !== "PATCH") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  try {
    const user = await verifyAuth(req);
    const { code } = req.body as { code?: string };

    if (!code || typeof code !== "string") {
      res.status(400).json({ error: "code is required" });
      return;
    }
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length === 0 || trimmed.length > 8) {
      res.status(400).json({ error: "Mã phải từ 1–8 ký tự" });
      return;
    }
    if (!/^[A-Z0-9]+$/.test(trimmed)) {
      res.status(400).json({ error: "Mã chỉ được dùng chữ cái và số" });
      return;
    }

    // Check uniqueness
    const existing = await sql`
      SELECT id FROM affiliates WHERE referral_code = ${trimmed}
        AND firebase_uid != ${user.uid}
    `;
    if (existing.length > 0) {
      res.status(409).json({ error: "Mã này đã được sử dụng, vui lòng chọn mã khác" });
      return;
    }

    await sql`
      UPDATE affiliates SET referral_code = ${trimmed}, updated_at = NOW()
      WHERE firebase_uid = ${user.uid}
    `;

    res.status(200).json({ code: trimmed });
  } catch (err) {
    if (err instanceof ApiError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error("/api/affiliate/referral-code error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
