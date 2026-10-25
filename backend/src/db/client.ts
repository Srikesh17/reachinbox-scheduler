import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';

const { Pool } = pg;

const useSsl =
  config.databaseUrl.includes('render.com') ||
  config.databaseUrl.includes('neon.tech') ||
  config.databaseUrl.includes('supabase.co') ||
  (!config.databaseUrl.includes('localhost') &&
    !config.databaseUrl.includes('127.0.0.1') &&
    config.isProduction);

export const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: useSsl ? { rejectUnauthorized: false } : undefined,
});

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS emails (
  id BIGSERIAL PRIMARY KEY,
  user_email TEXT NOT NULL,
  recipient TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  sender TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'processing', 'sent', 'failed')),
  delay_seconds INTEGER NOT NULL DEFAULT 2,
  hourly_limit INTEGER NOT NULL DEFAULT 100,
  sent_at TIMESTAMPTZ,
  failure_reason TEXT,
  message_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS emails_status_scheduled_idx ON emails(status, scheduled_at);
CREATE INDEX IF NOT EXISTS emails_user_created_idx ON emails(user_email, created_at DESC);
`;

export async function initDb() {
  let sql = SCHEMA_SQL;
  try {
    const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
    const schemaPath = path.resolve(currentDirectory, 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      sql = fs.readFileSync(schemaPath, 'utf-8');
    }
  } catch {}
  await pool.query(sql);
}
