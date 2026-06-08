// api/_lib/auth.ts
import type { VercelRequest } from "@vercel/node";
import admin from "firebase-admin";

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

export async function verifyAuth(req: VercelRequest): Promise<AuthUser> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    throw new ApiError(401, "Missing or invalid Authorization header");
  }
  const token = authHeader.slice(7);
  try {
    initAdmin();
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
