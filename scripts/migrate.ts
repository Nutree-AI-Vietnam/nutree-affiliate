// scripts/migrate.ts
// Run once: npx ts-node --project tsconfig.api.json scripts/migrate.ts
// Safe to re-run: uses CREATE TABLE IF NOT EXISTS and ALTER TABLE ADD COLUMN IF NOT EXISTS
import { neon } from "@neondatabase/serverless";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);

async function migrate() {
  // ── affiliates ────────────────────────────────────────────────────────────
  await sql`CREATE TABLE IF NOT EXISTS affiliates (
    id              VARCHAR PRIMARY KEY,
    firebase_uid    VARCHAR UNIQUE,
    auth_provider   VARCHAR NOT NULL DEFAULT 'neon',
    auth_subject_id VARCHAR,
    email           VARCHAR NOT NULL DEFAULT '',
    display_name    VARCHAR NOT NULL DEFAULT '',
    name            VARCHAR NOT NULL DEFAULT '',
    partner_type    VARCHAR,
    role            VARCHAR NOT NULL DEFAULT 'affiliate',
    status          VARCHAR NOT NULL DEFAULT 'active',
    bank_info       JSONB,
    onboarded       BOOLEAN NOT NULL DEFAULT FALSE,
    password_hash   VARCHAR,
    referral_code   VARCHAR,
    balance         NUMERIC NOT NULL DEFAULT 0,
    total_earned    NUMERIC NOT NULL DEFAULT 0,
    total_withdrawn NUMERIC NOT NULL DEFAULT 0,
    pending_trials  INTEGER NOT NULL DEFAULT 0,
    active_subscriptions INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;

  // Idempotent column additions for existing production tables
  await sql`ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS auth_provider VARCHAR NOT NULL DEFAULT 'neon'`;
  await sql`ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS auth_subject_id VARCHAR`;
  await sql`ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS display_name VARCHAR`;
  await sql`ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS partner_type VARCHAR`;
  await sql`ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS status VARCHAR NOT NULL DEFAULT 'active'`;
  await sql`ALTER TABLE affiliates ALTER COLUMN auth_provider SET DEFAULT 'neon'`;

  // Backfill new identity columns from old firebase_uid
  await sql`UPDATE affiliates SET auth_subject_id = firebase_uid WHERE auth_subject_id IS NULL AND firebase_uid IS NOT NULL`;
  await sql`UPDATE affiliates SET display_name = name WHERE (display_name IS NULL OR display_name = '') AND name IS NOT NULL AND name != ''`;

  // Normalize partner_type and role: old role='pt'/'kol' → partner_type, role='affiliate'
  await sql`UPDATE affiliates SET partner_type = role WHERE partner_type IS NULL AND role IN ('pt', 'kol')`;
  await sql`UPDATE affiliates SET role = 'affiliate' WHERE role IN ('pt', 'kol')`;

  // Unique identity constraint (idempotent)
  await sql`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_affiliates_auth_identity') THEN
        ALTER TABLE affiliates ADD CONSTRAINT uq_affiliates_auth_identity UNIQUE (auth_provider, auth_subject_id);
      END IF;
    END $$
  `;

  console.log("✓ affiliates");

  // ── affiliate_codes ───────────────────────────────────────────────────────
  await sql`CREATE TABLE IF NOT EXISTS affiliate_codes (
    id           VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
    affiliate_id VARCHAR NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
    code         VARCHAR NOT NULL,
    status       VARCHAR NOT NULL DEFAULT 'active',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;

  // Unique active code (case-insensitive)
  await sql`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'uniq_active_affiliate_code') THEN
        CREATE UNIQUE INDEX uniq_active_affiliate_code ON affiliate_codes (UPPER(code)) WHERE status = 'active';
      END IF;
    END $$
  `;

  // Migrate referral_code from affiliates into affiliate_codes
  await sql`
    INSERT INTO affiliate_codes (id, affiliate_id, code, status, created_at, updated_at)
    SELECT gen_random_uuid()::text, a.id, a.referral_code, 'active', a.created_at, a.updated_at
    FROM affiliates a
    WHERE a.referral_code IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM affiliate_codes c WHERE c.affiliate_id = a.id AND c.status = 'active'
      )
    ON CONFLICT DO NOTHING
  `;

  console.log("✓ affiliate_codes");

  // ── commission_rules ──────────────────────────────────────────────────────
  await sql`CREATE TABLE IF NOT EXISTS commission_rules (
    id            VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
    rule_name     VARCHAR NOT NULL,
    partner_type  VARCHAR,
    affiliate_id  VARCHAR REFERENCES affiliates(id) ON DELETE SET NULL,
    trigger_event VARCHAR NOT NULL DEFAULT 'first_paid',
    amount        NUMERIC NOT NULL DEFAULT 300000,
    currency      VARCHAR NOT NULL DEFAULT 'VND',
    validity_days INTEGER,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    is_default    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;

  await sql`
    INSERT INTO commission_rules (rule_name, trigger_event, amount, currency, is_active, is_default)
    SELECT 'Default first-paid commission', 'first_paid', 300000, 'VND', true, true
    WHERE NOT EXISTS (SELECT 1 FROM commission_rules WHERE is_default = true)
  `;

  console.log("✓ commission_rules");

  // ── affiliate_ledger_entries ──────────────────────────────────────────────
  await sql`CREATE TABLE IF NOT EXISTS affiliate_ledger_entries (
    id              VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
    affiliate_id    VARCHAR NOT NULL REFERENCES affiliates(id),
    entry_type      VARCHAR NOT NULL,
    amount          NUMERIC NOT NULL,
    idempotency_key VARCHAR UNIQUE,
    reference_id    VARCHAR,
    reference_type  VARCHAR,
    note            TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;

  // Backfill total_earned as opening credit entries
  await sql`
    INSERT INTO affiliate_ledger_entries (affiliate_id, entry_type, amount, idempotency_key, note)
    SELECT a.id, 'credit', a.total_earned,
           'migration_earned_' || a.id, 'Migrated from mutable counter'
    FROM affiliates a
    WHERE a.total_earned > 0
      AND NOT EXISTS (
        SELECT 1 FROM affiliate_ledger_entries e
        WHERE e.idempotency_key = 'migration_earned_' || a.id
      )
  `;

  // Backfill total_withdrawn as payout_deduction entries
  await sql`
    INSERT INTO affiliate_ledger_entries (affiliate_id, entry_type, amount, idempotency_key, note)
    SELECT a.id, 'payout_deduction', a.total_withdrawn,
           'migration_withdrawn_' || a.id, 'Migrated from mutable counter'
    FROM affiliates a
    WHERE a.total_withdrawn > 0
      AND NOT EXISTS (
        SELECT 1 FROM affiliate_ledger_entries e
        WHERE e.idempotency_key = 'migration_withdrawn_' || a.id
      )
  `;

  console.log("✓ affiliate_ledger_entries");

  // ── affiliate_payouts ─────────────────────────────────────────────────────
  await sql`CREATE TABLE IF NOT EXISTS affiliate_payouts (
    id              VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
    affiliate_id    VARCHAR NOT NULL REFERENCES affiliates(id),
    amount          NUMERIC NOT NULL,
    status          VARCHAR NOT NULL DEFAULT 'requested',
    payment_method  VARCHAR,
    payment_details JSONB,
    admin_note      TEXT,
    requested_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMPTZ,
    period          VARCHAR(7),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;

  console.log("✓ affiliate_payouts");

  // Add period column (YYYY-MM) for monthly payout tracking
  await sql`ALTER TABLE affiliate_payouts ADD COLUMN IF NOT EXISTS period VARCHAR(7)`;

  // Unique constraint: one request per affiliate per calendar month
  await sql`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'uq_affiliate_payouts_period') THEN
        CREATE UNIQUE INDEX uq_affiliate_payouts_period
          ON affiliate_payouts (affiliate_id, period)
          WHERE period IS NOT NULL;
      END IF;
    END $$
  `;

  console.log("✓ affiliate_payouts.period migration");

  // ── affiliate_conversions (needed by stats and Phase 2 ingestion) ─────────
  await sql`CREATE TABLE IF NOT EXISTS affiliate_conversions (
    id                VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
    affiliate_id      VARCHAR NOT NULL REFERENCES affiliates(id),
    user_id           VARCHAR NOT NULL,
    affiliate_code_id VARCHAR REFERENCES affiliate_codes(id),
    event_id          VARCHAR UNIQUE,
    status            VARCHAR NOT NULL DEFAULT 'trial',
    converted_at      TIMESTAMPTZ,
    ended_at          TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;

  // ── affiliate_webhook_events (needed by Phase 2 ingestion) ───────────────
  await sql`CREATE TABLE IF NOT EXISTS affiliate_webhook_events (
    id            VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
    event_id      VARCHAR NOT NULL UNIQUE,
    event_type    VARCHAR NOT NULL,
    status        VARCHAR NOT NULL DEFAULT 'pending',
    payload       JSONB,
    error_message TEXT,
    received_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at  TIMESTAMPTZ
  )`;

  // One active attribution per Nutree app user — dedup enforced here so
  // nutree-affiliate never needs to trust MealTrack to check locally.
  await sql`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_affiliate_conversions_user_id') THEN
        ALTER TABLE affiliate_conversions ADD CONSTRAINT uq_affiliate_conversions_user_id UNIQUE (user_id);
      END IF;
    END $$
  `;

  await sql`ALTER TABLE affiliate_conversions ADD COLUMN IF NOT EXISTS occurred_at  TIMESTAMPTZ`;
  await sql`ALTER TABLE affiliate_conversions ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ`;

  console.log("✓ affiliate_conversions, affiliate_webhook_events");
  console.log("Migration complete");
}

migrate().catch((err) => { console.error(err); process.exit(1); });
