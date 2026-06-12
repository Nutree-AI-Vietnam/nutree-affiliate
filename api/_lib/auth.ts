// api/_lib/auth.ts
import type { VercelRequest } from "@vercel/node";
import { createHmac } from "crypto";
import type { JWTPayload } from "jose";

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
  const s = process.env.AFFILIATE_ADMIN_SECRET;
  if (!s) throw new ApiError(500, "Admin auth not configured");
  return s;
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

let cachedAuthBaseUrl: string | null = null;
type JoseModule = typeof import("jose");

let joseModulePromise: Promise<JoseModule> | null = null;
let cachedJwks: ReturnType<JoseModule["createRemoteJWKSet"]> | null = null;

function loadJose(): Promise<JoseModule> {
  joseModulePromise ??= import("jose");
  return joseModulePromise;
}

function neonAuthBaseUrl(): string {
  const baseUrl = process.env.NEON_AUTH_BASE_URL || process.env.VITE_NEON_AUTH_URL;
  if (!baseUrl) throw new ApiError(500, "Neon Auth not configured");
  return baseUrl.replace(/\/$/, "");
}

async function neonJwks() {
  const baseUrl = neonAuthBaseUrl();
  if (!cachedJwks || cachedAuthBaseUrl !== baseUrl) {
    const { createRemoteJWKSet } = await loadJose();
    cachedAuthBaseUrl = baseUrl;
    cachedJwks = createRemoteJWKSet(
      new URL(`${baseUrl}/.well-known/jwks.json`),
      { timeoutDuration: 15_000 },
    );
  }
  return cachedJwks;
}

function toAuthUser(payload: JWTPayload): AuthUser {
  const uid = typeof payload.sub === "string"
    ? payload.sub
    : typeof payload.id === "string"
      ? payload.id
      : "";
  if (!uid) throw new ApiError(401, "Invalid token subject");
  const name = typeof payload.name === "string" && payload.name
    ? payload.name
    : typeof payload.email === "string" && payload.email
      ? payload.email
      : "Affiliate";
  const email = typeof payload.email === "string" ? payload.email : "";
  return { uid, name, email };
}

export async function verifyAuth(req: VercelRequest): Promise<AuthUser> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    throw new ApiError(401, "Missing or invalid Authorization header");
  }
  const token = authHeader.slice(7);
  const baseUrl = neonAuthBaseUrl();

  try {
    const { jwtVerify } = await loadJose();
    const { payload } = await jwtVerify(token, await neonJwks(), {
      issuer: new URL(baseUrl).origin,
    });
    return toAuthUser(payload);
  } catch (err) {
    console.error("Neon Auth token validation failed:", err instanceof Error ? err.message : err);
    throw new ApiError(401, "Invalid or expired token");
  }
}
