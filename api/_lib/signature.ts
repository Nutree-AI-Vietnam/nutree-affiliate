// api/_lib/signature.ts
// HMAC-SHA256 request signing shared by all internal service-to-service endpoints.
// Sender (MealTrack Python) signs: HMAC-SHA256(secret, "${timestamp}.${rawBody}")
// Headers: X-Timestamp (unix seconds), X-Signature (hex)
import { createHmac, timingSafeEqual } from "crypto";
import type { VercelRequest } from "@vercel/node";
import { ApiError } from "./auth";

const REPLAY_WINDOW_SECONDS = 300;

function internalSecret(): string {
  const s = process.env.AFFILIATE_INTERNAL_SECRET;
  if (!s) throw new ApiError(500, "Internal API not configured");
  return s;
}

/**
 * Produce an HMAC-SHA256 hex signature for the given body + timestamp.
 * Used in tests and by the MealTrack sender side.
 */
export function createSignature(rawBody: string, timestamp: string, secret: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
}

/**
 * Verify X-Timestamp and X-Signature headers on an inbound internal request.
 * Throws ApiError on any failure.
 */
export function verifySignature(req: VercelRequest, rawBody: string): void {
  const timestamp = req.headers["x-timestamp"] as string | undefined;
  const signature = req.headers["x-signature"] as string | undefined;

  if (!timestamp || !signature) {
    throw new ApiError(401, "Missing authentication headers");
  }

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) throw new ApiError(401, "Invalid timestamp");

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > REPLAY_WINDOW_SECONDS) {
    throw new ApiError(401, "Request timestamp expired");
  }

  const expected = createSignature(rawBody, timestamp, internalSecret());
  const expectedBuf = Buffer.from(expected, "hex");

  let actualBuf: Buffer;
  try {
    actualBuf = Buffer.from(signature, "hex");
  } catch {
    throw new ApiError(401, "Invalid signature format");
  }

  if (expectedBuf.length !== actualBuf.length || !timingSafeEqual(expectedBuf, actualBuf)) {
    throw new ApiError(401, "Invalid signature");
  }
}
