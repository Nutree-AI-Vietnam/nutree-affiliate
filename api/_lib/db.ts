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
