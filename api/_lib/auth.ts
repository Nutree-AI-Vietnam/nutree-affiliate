// api/_lib/auth.ts
import type { VercelRequest } from "@vercel/node";
import admin from "firebase-admin";
import { createHmac } from "crypto";

function initAdmin() {
  if (admin.apps.length > 0) return;
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT!);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

export interface AuthUser {
  uid: string;
  name: string;
  email: string;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function adminSecret(): string {
  return process.env.DATABASE_URL ?? "nutree-admin-secret";
}

export function signAdminToken(affiliateId: string): string {
  const hmac = createHmac("sha256", adminSecret()).update(affiliateId).digest("hex");
  return `admin.${affiliateId}.${hmac}`;
}

export interface AdminSessionUser {
  affiliateId: string;
}

export function verifyAdminSession(req: VercelRequest): AdminSessionUser {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer admin.")) {
    throw new ApiError(401, "Not authenticated");
  }
  const parts = authHeader.slice(7).split("."); // ["admin", affiliateId, hmac]
  if (parts.length !== 3 || parts[0] !== "admin") {
    throw new ApiError(401, "Invalid admin token");
  }
  const [, affiliateId, hmac] = parts;
  const expected = createHmac("sha256", adminSecret()).update(affiliateId).digest("hex");
  if (hmac !== expected) {
    throw new ApiError(401, "Invalid admin token");
  }
  return { affiliateId };
}

export async function verifyAuth(req: VercelRequest): Promise<AuthUser> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    throw new ApiError(401, "Missing or invalid Authorization header");
  }
  const token = authHeader.slice(7);
  // initAdmin throws if FIREBASE_SERVICE_ACCOUNT is missing — keep outside try
  // so a misconfiguration returns 500, not a misleading 401
  initAdmin();
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    return {
      uid: decoded.uid,
      name: (decoded.name as string) ?? decoded.email ?? "Affiliate",
      email: (decoded.email as string) ?? "",
    };
  } catch {
    throw new ApiError(401, "Invalid or expired token");
  }
}
