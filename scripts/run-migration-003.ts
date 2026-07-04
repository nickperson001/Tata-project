import { pgPool } from '../src/config/supabase';
import fs from 'fs';
import path from 'path';

async function run() {
  if (!pgPool) {
    console.error('pgPool not available — check DATABASE_URL in .env');
    process.exit(1);
  }
  const sql = fs.readFileSync(path.resolve(__dirname, '../src/migrations/003_sales_channels_and_triggers.sql'), 'utf-8');
  const client = await pgPool.connect();
  try {
    await client.query(sql);
    console.log('Migration 003 applied successfully.');
  } finally {
    client.release();
    await pgPool.end();
  }
}

run().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
