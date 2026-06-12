// api/internal/mealtrack-events.ts
// Ingests signed MealTrack lifecycle events into an idempotent ledger.
// Each event_id is accepted exactly once; duplicates get a 200 duplicate response.
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { ensureAffiliateIdentitySchema, sql } from "../_lib/db";
import { ApiError } from "../_lib/auth";
import { verifyInternalRequest, readRawBody } from "../_lib/internal-auth";
import { getActiveCommissionRule, insertLedgerEntry } from "../_lib/ledger";

export const config = { api: { bodyParser: false } };

interface EventEnvelope {
  event_id: string;
  event_type: string;
  occurred_at?: string;
  mealtrack_user_id: string;
  // affiliate_id is required for affiliate_attribution_created; for lifecycle
  // events nutree-affiliate resolves it from affiliate_conversions by user_id.
  affiliate_id?: string;
  affiliate_code?: string;
  subscription_id?: string;
  product_id?: string;
  period_type?: string;
  currency?: string;
  amount?: number;
  metadata?: Record<string, unknown>;
}

function isMissingConflictConstraint(err: unknown): boolean {
  return (err as { code?: string }).code === "42P10";
}

function isDuplicateKey(err: unknown): boolean {
  return (err as { code?: string }).code === "23505";
}

async function insertInboxEvent(evt: EventEnvelope): Promise<boolean> {
  try {
    const inserted = await sql`
      INSERT INTO affiliate_webhook_events (event_id, event_type, payload, status)
      VALUES (${evt.event_id}, ${evt.event_type}, ${JSON.stringify(evt)}, 'pending')
      ON CONFLICT (event_id) DO NOTHING
      RETURNING id
    `;
    return inserted.length > 0;
  } catch (err) {
    if (!isMissingConflictConstraint(err)) throw err;
  }

  const existing = await sql`
    SELECT id FROM affiliate_webhook_events
    WHERE event_id = ${evt.event_id}
    LIMIT 1
  `;
  if (existing.length > 0) return false;

  try {
    const inserted = await sql`
      INSERT INTO affiliate_webhook_events (event_id, event_type, payload, status)
      VALUES (${evt.event_id}, ${evt.event_type}, ${JSON.stringify(evt)}, 'pending')
      RETURNING id
    `;
    return inserted.length > 0;
  } catch (err) {
    if (isDuplicateKey(err)) return false;
    throw err;
  }
}

async function insertTrialAttribution(
  affiliateId: string,
  userId: string,
  codeId: string | null,
  eventId: string,
  occurredAt: string,
): Promise<boolean> {
  try {
    const inserted = await sql`
      INSERT INTO affiliate_conversions
        (affiliate_id, user_id, affiliate_code_id, event_id, status, occurred_at, locked_until)
      VALUES (
        ${affiliateId}, ${userId}, ${codeId}, ${eventId}, 'trial',
        ${occurredAt},
        ${occurredAt}::timestamptz + INTERVAL '15 days'
      )
      ON CONFLICT (user_id) DO NOTHING
      RETURNING id
    `;
    return inserted.length > 0;
  } catch (err) {
    if (!isMissingConflictConstraint(err)) throw err;
  }

  const existing = await sql`
    SELECT id FROM affiliate_conversions
    WHERE user_id = ${userId}
    LIMIT 1
  `;
  if (existing.length > 0) return false;

  try {
    const inserted = await sql`
      INSERT INTO affiliate_conversions
        (affiliate_id, user_id, affiliate_code_id, event_id, status, occurred_at, locked_until)
      VALUES (
        ${affiliateId}, ${userId}, ${codeId}, ${eventId}, 'trial',
        ${occurredAt},
        ${occurredAt}::timestamptz + INTERVAL '15 days'
      )
      RETURNING id
    `;
    return inserted.length > 0;
  } catch (err) {
    if (isDuplicateKey(err)) return false;
    throw err;
  }
}

async function insertDirectConversion(
  affiliateId: string,
  userId: string,
  eventId: string,
  occurredAt: string,
): Promise<boolean> {
  try {
    const inserted = await sql`
      INSERT INTO affiliate_conversions
        (affiliate_id, user_id, event_id, status, converted_at, occurred_at, locked_until)
      VALUES (
        ${affiliateId}, ${userId}, ${eventId}, 'converted', NOW(),
        ${occurredAt},
        ${occurredAt}::timestamptz + INTERVAL '15 days'
      )
      ON CONFLICT (user_id) DO NOTHING
      RETURNING id
    `;
    return inserted.length > 0;
  } catch (err) {
    if (!isMissingConflictConstraint(err)) throw err;
  }

  const existing = await sql`
    SELECT id FROM affiliate_conversions
    WHERE user_id = ${userId}
    LIMIT 1
  `;
  if (existing.length > 0) return false;

  try {
    const inserted = await sql`
      INSERT INTO affiliate_conversions
        (affiliate_id, user_id, event_id, status, converted_at, occurred_at, locked_until)
      VALUES (
        ${affiliateId}, ${userId}, ${eventId}, 'converted', NOW(),
        ${occurredAt},
        ${occurredAt}::timestamptz + INTERVAL '15 days'
      )
      RETURNING id
    `;
    return inserted.length > 0;
  } catch (err) {
    if (isDuplicateKey(err)) return false;
    throw err;
  }
}

async function processEvent(evt: EventEnvelope): Promise<void> {
  const { event_type, event_id, affiliate_id, mealtrack_user_id } = evt;

  switch (event_type) {
    case "affiliate_attribution_created": {
      // affiliate_id is guaranteed present (validated above)
      let codeId: string | null = null;
      if (evt.affiliate_code) {
        const codeRows = await sql`
          SELECT id FROM affiliate_codes
          WHERE UPPER(code) = UPPER(${evt.affiliate_code}) AND status = 'active' LIMIT 1
        `;
        codeId = (codeRows[0] as { id: string } | undefined)?.id ?? null;
      }
      const trialOccurredAt = evt.occurred_at ?? new Date().toISOString();
      if (!evt.occurred_at) {
        console.warn("affiliate_attribution_created missing occurred_at, using NOW()", evt.event_id);
      }
      await insertTrialAttribution(affiliate_id!, mealtrack_user_id, codeId, event_id, trialOccurredAt);
      break;
    }

    case "subscription_initial_purchase": {
      // Fall back to NOW() if MealTrack omits occurred_at; log a warning so it's visible.
      const effectiveOccurredAt = evt.occurred_at ?? new Date().toISOString();
      if (!evt.occurred_at) {
        console.warn("subscription_initial_purchase missing occurred_at, using NOW()", evt.event_id);
      }

      // nutree-affiliate owns affiliate_id — resolve from conversions by user_id.
      const trialRows = await sql`
        SELECT id, affiliate_id FROM affiliate_conversions
        WHERE user_id = ${mealtrack_user_id} AND status = 'trial'
        LIMIT 1
      `;
      const trial = trialRows[0] as { id: string; affiliate_id: string } | undefined;

      if (trial) {
        await sql`
          UPDATE affiliate_conversions
          SET status = 'converted', converted_at = NOW(),
              occurred_at = ${effectiveOccurredAt},
              locked_until = ${effectiveOccurredAt}::timestamptz + INTERVAL '15 days'
          WHERE id = ${trial.id}
        `;
        const rule = await getActiveCommissionRule(trial.affiliate_id);
        await insertLedgerEntry(
          trial.affiliate_id, "credit", rule.amount,
          `credit_${event_id}`, event_id, "subscription_initial_purchase",
          "First-paid conversion commission"
        );
      } else {
        // No prior trial attribution — insert converted directly if affiliate_id provided.
        if (affiliate_id) {
          const inserted = await insertDirectConversion(
            affiliate_id,
            mealtrack_user_id,
            event_id,
            effectiveOccurredAt,
          );
          if (inserted) {
            const rule = await getActiveCommissionRule(affiliate_id);
            await insertLedgerEntry(
              affiliate_id, "credit", rule.amount,
              `credit_${event_id}`, event_id, "subscription_initial_purchase",
              "First-paid conversion commission"
            );
          }
        }
      }
      break;
    }

    case "subscription_refund": {
      const convertedRows = await sql`
        SELECT id, affiliate_id FROM affiliate_conversions
        WHERE user_id = ${mealtrack_user_id} AND status = 'converted'
        LIMIT 1
      `;
      const converted = convertedRows[0] as { id: string; affiliate_id: string } | undefined;
      if (!converted) break;

      const rule = await getActiveCommissionRule(converted.affiliate_id);
      const inserted = await insertLedgerEntry(
        converted.affiliate_id, "reversal", rule.amount,
        `reversal_${event_id}`, event_id, "subscription_refund",
        "Subscription refund reversal"
      );
      if (inserted) {
        await sql`
          UPDATE affiliate_conversions SET status = 'refunded', ended_at = NOW()
          WHERE id = ${converted.id}
        `;
      }
      break;
    }

    case "subscription_canceled":
    case "subscription_expired": {
      const newStatus = event_type === "subscription_canceled" ? "canceled" : "expired";
      await sql`
        UPDATE affiliate_conversions SET status = ${newStatus}, ended_at = NOW()
        WHERE user_id = ${mealtrack_user_id}
          AND status IN ('trial', 'converted')
      `;
      break;
    }

    case "subscription_renewal":
      // Recorded in inbox only — no commission credit until recurring commission is enabled
      break;

    default:
      // Unknown event types are accepted and stored but not processed
      break;
  }
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
    const rawBody = await readRawBody(req);
    verifyInternalRequest(req, rawBody);

    let evt: EventEnvelope;
    try {
      evt = JSON.parse(rawBody) as EventEnvelope;
    } catch {
      res.status(400).json({ error: "Invalid JSON body" });
      return;
    }
    if (!evt.event_id || !evt.event_type || !evt.mealtrack_user_id) {
      res.status(400).json({ error: "event_id, event_type, mealtrack_user_id are required" });
      return;
    }
    if (evt.event_type === "affiliate_attribution_created" && !evt.affiliate_id) {
      res.status(400).json({ error: "affiliate_id is required for affiliate_attribution_created" });
      return;
    }
    await ensureAffiliateIdentitySchema();

    if (!(await insertInboxEvent(evt))) {
      res.status(200).json({ status: "duplicate" });
      return;
    }

    try {
      await processEvent(evt);
      await sql`
        UPDATE affiliate_webhook_events SET status = 'processed', processed_at = NOW()
        WHERE event_id = ${evt.event_id}
      `;
    } catch (processErr) {
      const errMsg = processErr instanceof Error ? processErr.message : String(processErr);
      console.error("Event processing failed:", evt.event_id, errMsg);
      await sql`
        UPDATE affiliate_webhook_events SET status = 'failed', error_message = ${errMsg}
        WHERE event_id = ${evt.event_id}
      `;
      res.status(500).json({ error: "Event processing failed", retryable: true });
      return;
    }

    res.status(200).json({ status: "accepted" });
  } catch (err) {
    if (err instanceof ApiError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error("/api/internal/mealtrack-events error:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "Internal server error" });
  }
}
