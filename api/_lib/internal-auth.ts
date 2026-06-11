// api/_lib/internal-auth.ts
import type { VercelRequest } from "@vercel/node";
import { ApiError } from "./auth";
import { verifySignature } from "./signature";

/**
 * Gate for internal service-to-service endpoints.
 * Rejects browser auth JWTs (which are never valid here) and verifies HMAC.
 */
export function verifyInternalRequest(req: VercelRequest, rawBody: string): void {
  const auth = req.headers.authorization ?? "";
  // Browser auth tokens are JWTs starting with "Bearer ey".
  if (auth.startsWith("Bearer ey")) {
    throw new ApiError(401, "Internal endpoints require service authentication");
  }
  verifySignature(req, rawBody);
}

/**
 * Buffer the full request body from the stream.
 * Use together with: export const config = { api: { bodyParser: false } }
 */
export async function readRawBody(req: VercelRequest): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string));
  }
  const rawBody = Buffer.concat(chunks).toString("utf-8");
  if (rawBody) return rawBody;

  if (typeof req.body === "string") return req.body;
  if (req.body && typeof req.body === "object") return JSON.stringify(req.body);
  return rawBody;
}
