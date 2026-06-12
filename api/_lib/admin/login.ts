// api/admin/login.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql } from "../db";
import { scryptSync, timingSafeEqual, randomBytes } from "crypto";
import { signAdminToken } from "../auth";

function verifyPassword(password: string, stored: string): boolean {
  // stored format: salt:hash (hex)
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const hashBuf = Buffer.from(hash, "hex");
  const derived = scryptSync(password, salt, 64);
  return timingSafeEqual(hashBuf, derived);
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      res.status(400).json({ error: "Email và mật khẩu là bắt buộc" });
      return;
    }

    const rows = await sql`
      SELECT id, name, email, role, password_hash, onboarded
      FROM affiliates
      WHERE email = ${email.trim().toLowerCase()} AND role = 'admin'
    `;

    if (rows.length === 0) {
      res.status(401).json({ error: "Email hoặc mật khẩu không đúng" });
      return;
    }

    const admin = rows[0] as {
      id: string; name: string; email: string;
      role: string; password_hash: string | null; onboarded: boolean;
    };

    if (!admin.password_hash || !verifyPassword(password, admin.password_hash)) {
      res.status(401).json({ error: "Email hoặc mật khẩu không đúng" });
      return;
    }

    res.status(200).json({
      affiliateId: admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      onboarded: true,
      adminToken: signAdminToken(admin.id),
    });
  } catch (err) {
    console.error("/api/admin/login error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
