// api/migrate.ts
// Run once locally: npx ts-node --project tsconfig.api.json api/migrate.ts
import { neon } from "@neondatabase/serverless";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);

async function migrate() {
  await sql`
    CREATE TABLE IF NOT EXISTS affiliates (
      id           VARCHAR PRIMARY KEY,
      firebase_uid VARCHAR UNIQUE NOT NULL,
      name         VARCHAR NOT NULL,
      email        VARCHAR NOT NULL,
      role         VARCHAR NOT NULL DEFAULT 'pt',
      bank_info    JSON,
      created_at   TIMESTAMPTZ DEFAULT NOW(),
      updated_at   TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  console.log("✓ affiliates table created");
}

migrate().catch((err) => { console.error(err); process.exit(1); });
