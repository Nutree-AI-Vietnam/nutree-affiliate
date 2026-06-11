// api/internal/mealtrack-events.ts
// Ingests signed MealTrack lifecycle events into an idempotent ledger.
// Each event_id is accepted exactly once; duplicates get a 200 duplicate response.
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql } from "../_lib/db";
import { ApiError } from "../_lib/auth";
import { verifyInternalRequest, readRawBody } from "../_lib/internal-auth";
import { getActiveCommissionRule, insertLedgerEntry } from "../_lib/ledger";

export const config = { api: { bodyParser: false } };

interface EventEnvelope {
  event_id: string;
  event_type: string;
  occurred_at: string;
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
      // UNIQUE(user_id) enforces one-attribution-per-user; duplicate calls are no-ops.
      await sql`
        INSERT INTO affiliate_conversions (affiliate_id, user_id, affiliate_code_id, event_id, status)
        VALUES (${affiliate_id}, ${mealtrack_user_id}, ${codeId}, ${event_id}, 'trial')
        ON CONFLICT (user_id) DO NOTHING
      `;
      break;
    }

    case "subscription_initial_purchase": {
      // nutree-affiliate owns affiliate_id — resolve from conversions by user_id.
      const trialRows = await sql`
        SELECT id, affiliate_id FROM affiliate_conversions
        WHERE user_id = ${mealtrack_user_id} AND status = 'trial'
        LIMIT 1
      `;
      const trial = trialRows[0] as { id: string; affiliate_id: string } | undefined;

      if (trial) {
        await sql`
          UPDATE affiliate_conversions SET status = 'converted', converted_at = NOW()
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
          await sql`
            INSERT INTO affiliate_conversions (affiliate_id, user_id, event_id, status, converted_at)
            VALUES (${affiliate_id}, ${mealtrack_user_id}, ${event_id}, 'converted', NOW())
            ON CONFLICT (user_id) DO NOTHING
          `;
          const rule = await getActiveCommissionRule(affiliate_id);
          await insertLedgerEntry(
            affiliate_id, "credit", rule.amount,
            `credit_${event_id}`, event_id, "subscription_initial_purchase",
            "First-paid conversion commission"
          );
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

    const evt = JSON.parse(rawBody) as EventEnvelope;
    if (!evt.event_id || !evt.event_type || !evt.mealtrack_user_id) {
      res.status(400).json({ error: "event_id, event_type, mealtrack_user_id are required" });
      return;
    }
    if (evt.event_type === "affiliate_attribution_created" && !evt.affiliate_id) {
      res.status(400).json({ error: "affiliate_id is required for affiliate_attribution_created" });
      return;
    }

    // Idempotent inbox insert — returns empty when event_id already exists
    const inboxResult = await sql`
      INSERT INTO affiliate_webhook_events (event_id, event_type, payload, status)
      VALUES (${evt.event_id}, ${evt.event_type}, ${JSON.stringify(evt)}, 'pending')
      ON CONFLICT (event_id) DO NOTHING
      RETURNING id
    `;

    if (inboxResult.length === 0) {
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
