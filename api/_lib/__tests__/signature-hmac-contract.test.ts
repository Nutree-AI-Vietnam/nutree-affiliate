/**
 * Cross-service HMAC contract test for affiliate request signing.
 *
 * Verifies nutree-affiliate's createSignature produces the same digest as
 * MealTrack's _sign_request (Python hmac.new + sha256).
 * Both sides use: HMAC-SHA256(secret, `${timestamp}.${rawBody}`)
 *
 * Known vector also embedded in:
 * mealtrack_backend/tests/unit/infra/adapters/test_affiliate_service_adapter_signing.py
 */
import { createHmac } from "crypto";
import { describe, it, expect } from "vitest";
import { createSignature } from "../signature";

// Shared contract vector — same values as Python contract test
const SECRET = "test-secret-key";
const TIMESTAMP = "1749600000";
const BODY =
  '{"event_id":"test-evt-001","event_type":"subscription_initial_purchase","mealtrack_user_id":"user-123"}';
const EXPECTED_DIGEST =
  "0c1627287a582db38fbb7add6d4d1de535b38404f71ac2b8f695a31276e60fd6";

describe("createSignature cross-service contract", () => {
  it("matches the offline-computed cross-service contract vector", () => {
    expect(createSignature(BODY, TIMESTAMP, SECRET)).toBe(EXPECTED_DIGEST);
  });

  it("algorithm is HMAC-SHA256 of `${timestamp}.${body}`", () => {
    const expected = createHmac("sha256", SECRET)
      .update(`${TIMESTAMP}.${BODY}`)
      .digest("hex");
    expect(createSignature(BODY, TIMESTAMP, SECRET)).toBe(expected);
  });

  it("different secret → different digest", () => {
    expect(createSignature(BODY, TIMESTAMP, "secret-a")).not.toBe(
      createSignature(BODY, TIMESTAMP, "secret-b")
    );
  });

  it("different timestamp → different digest", () => {
    expect(createSignature(BODY, "1749600000", SECRET)).not.toBe(
      createSignature(BODY, "1749600001", SECRET)
    );
  });
});
