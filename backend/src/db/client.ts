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

export async function initDb() {
  const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
  const schemaPath = path.resolve(currentDirectory, 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf-8');
  await pool.query(sql);
}
