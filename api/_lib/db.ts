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
}

export function ensureAffiliateIdentitySchema(): Promise<void> {
  affiliateIdentitySchemaPromise ??= applyAffiliateIdentitySchema().catch((err) => {
    affiliateIdentitySchemaPromise = null;
    throw err;
  });
  return affiliateIdentitySchemaPromise;
}
