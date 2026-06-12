// api/_lib/db.ts
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { neon } from "@neondatabase/serverless";

function loadLocalEnvIfNeeded() {
  if (process.env.DATABASE_URL) return;
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;

  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq);
    const value = trimmed.slice(eq + 1);
    process.env[key] ??= value;
  }
}

loadLocalEnvIfNeeded();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set");
}

export const sql = neon(process.env.DATABASE_URL);

let affiliateIdentitySchemaPromise: Promise<void> | null = null;

async function applyAffiliateIdentitySchema(): Promise<void> {
  await sql`ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS auth_provider VARCHAR NOT NULL DEFAULT 'neon'`;
  await sql`ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS auth_subject_id VARCHAR`;
  await sql`ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS display_name VARCHAR NOT NULL DEFAULT ''`;
  await sql`ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS name VARCHAR NOT NULL DEFAULT ''`;
  await sql`ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS partner_type VARCHAR`;
  await sql`ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS status VARCHAR NOT NULL DEFAULT 'active'`;
  await sql`ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS bank_info JSONB`;
  await sql`ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS onboarded BOOLEAN NOT NULL DEFAULT FALSE`;
  await sql`ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS password_hash VARCHAR`;
  await sql`ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS referral_code VARCHAR`;
  await sql`ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS balance NUMERIC NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS total_earned NUMERIC NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS total_withdrawn NUMERIC NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS pending_trials INTEGER NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS active_subscriptions INTEGER NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`;
  await sql`ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`;

  await sql`ALTER TABLE affiliates ALTER COLUMN firebase_uid DROP NOT NULL`;
  await sql`ALTER TABLE affiliates ALTER COLUMN auth_subject_id DROP NOT NULL`;
  await sql`ALTER TABLE affiliates ALTER COLUMN partner_type DROP NOT NULL`;
  await sql`ALTER TABLE affiliates ALTER COLUMN bank_info DROP NOT NULL`;
  await sql`ALTER TABLE affiliates ALTER COLUMN password_hash DROP NOT NULL`;
  await sql`ALTER TABLE affiliates ALTER COLUMN referral_code DROP NOT NULL`;
  await sql`ALTER TABLE affiliates ALTER COLUMN auth_provider SET DEFAULT 'neon'`;
  await sql`ALTER TABLE affiliates ALTER COLUMN display_name SET DEFAULT ''`;
  await sql`ALTER TABLE affiliates ALTER COLUMN name SET DEFAULT ''`;
  await sql`ALTER TABLE affiliates ALTER COLUMN role SET DEFAULT 'affiliate'`;
  await sql`ALTER TABLE affiliates ALTER COLUMN status SET DEFAULT 'active'`;
  await sql`ALTER TABLE affiliates ALTER COLUMN onboarded SET DEFAULT FALSE`;
  await sql`ALTER TABLE affiliates ALTER COLUMN balance SET DEFAULT 0`;
  await sql`ALTER TABLE affiliates ALTER COLUMN total_earned SET DEFAULT 0`;
  await sql`ALTER TABLE affiliates ALTER COLUMN total_withdrawn SET DEFAULT 0`;
  await sql`ALTER TABLE affiliates ALTER COLUMN pending_trials SET DEFAULT 0`;
  await sql`ALTER TABLE affiliates ALTER COLUMN active_subscriptions SET DEFAULT 0`;
  await sql`ALTER TABLE affiliates ALTER COLUMN created_at SET DEFAULT NOW()`;
  await sql`ALTER TABLE affiliates ALTER COLUMN updated_at SET DEFAULT NOW()`;

  await sql`
    UPDATE affiliates
    SET auth_subject_id = firebase_uid
    WHERE auth_subject_id IS NULL AND firebase_uid IS NOT NULL
  `;
  await sql`
    UPDATE affiliates
    SET display_name = name
    WHERE (display_name IS NULL OR display_name = '') AND name IS NOT NULL AND name != ''
  `;
  await sql`UPDATE affiliates SET partner_type = role WHERE partner_type IS NULL AND role IN ('pt', 'kol')`;
  await sql`UPDATE affiliates SET role = 'affiliate' WHERE role IN ('pt', 'kol')`;

  await sql`CREATE TABLE IF NOT EXISTS affiliate_codes (
    id           VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
    affiliate_id VARCHAR NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
    code         VARCHAR NOT NULL,
    status       VARCHAR NOT NULL DEFAULT 'active',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'uniq_active_affiliate_code') THEN
        CREATE UNIQUE INDEX uniq_active_affiliate_code ON affiliate_codes (UPPER(code)) WHERE status = 'active';
      END IF;
    END $$
  `;
  await sql`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_affiliates_auth_identity') THEN
        ALTER TABLE affiliates ADD CONSTRAINT uq_affiliates_auth_identity UNIQUE (auth_provider, auth_subject_id);
      END IF;
    END $$
  `;

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

  await sql`ALTER TABLE affiliate_payouts ADD COLUMN IF NOT EXISTS period VARCHAR(7)`;
  await sql`ALTER TABLE affiliate_conversions ADD COLUMN IF NOT EXISTS occurred_at TIMESTAMPTZ`;
  await sql`ALTER TABLE affiliate_conversions ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ`;
  await sql`
    INSERT INTO commission_rules (rule_name, trigger_event, amount, currency, is_active, is_default)
    SELECT 'Default first-paid commission', 'first_paid', 300000, 'VND', true, true
    WHERE NOT EXISTS (SELECT 1 FROM commission_rules WHERE is_default = true)
  `;
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
  await sql`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'uq_affiliate_payouts_period') THEN
        CREATE UNIQUE INDEX uq_affiliate_payouts_period
          ON affiliate_payouts (affiliate_id, period)
          WHERE period IS NOT NULL;
      END IF;
    END $$
  `;
  await sql`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_affiliate_conversions_user_id') THEN
        ALTER TABLE affiliate_conversions ADD CONSTRAINT uq_affiliate_conversions_user_id UNIQUE (user_id);
      END IF;
    END $$
  `;
}

export function ensureAffiliateIdentitySchema(): Promise<void> {
  affiliateIdentitySchemaPromise ??= applyAffiliateIdentitySchema().catch((err) => {
    affiliateIdentitySchemaPromise = null;
    throw err;
  });
  return affiliateIdentitySchemaPromise;
}
