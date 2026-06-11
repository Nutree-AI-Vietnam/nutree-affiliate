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
 *
 * Vercel dev may materialise req.body as a Buffer or string before the stream
 * is readable, so we check those fast paths first to avoid Invalid JSON errors.
 */
export async function readRawBody(req: VercelRequest): Promise<string> {
  // Fast paths: Vercel dev sometimes populates req.body before stream is readable
  if (Buffer.isBuffer(req.body)) return (req.body as Buffer).toString("utf-8");
  if (typeof req.body === "string") return req.body;

  // Stream path: event-emitter is more reliable than for-await in Vercel dev
  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string));
    });
    req.on("end", () => {
      const rawBody = Buffer.concat(chunks).toString("utf-8");
      if (rawBody) { resolve(rawBody); return; }
      // Last resort: re-serialise a pre-parsed object (signature will fail,
      // but at least the handler returns 401 instead of crashing on JSON.parse)
      resolve(req.body && typeof req.body === "object" ? JSON.stringify(req.body) : "");
    });
    req.on("error", reject);
  });
}
