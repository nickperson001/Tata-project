import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Pool, type Pool as PgPool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const url: string | undefined = process.env.SUPABASE_URL;
const key: string | undefined = process.env.SUPABASE_KEY;

if (!url || !key) {
  console.error('\n[ERROR] SUPABASE_URL dan SUPABASE_KEY wajib diisi di file .env\n');
  process.exit(1);
}
if (!url.startsWith('https://')) {
  console.error('\n[ERROR] SUPABASE_URL tidak valid. Harus diawali https://\n');
  process.exit(1);
}

const supabase: SupabaseClient = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { params: { eventsPerSecond: 10 } },
  db: { schema: 'public' },
});

let pgPool: PgPool | null = null;
const dbUrl = process.env.DATABASE_URL;
if (dbUrl) {
  let connUrl = dbUrl;
  if (connUrl.includes('supabase.co') && !connUrl.includes('pgbouncer=true')) {
    connUrl = connUrl.replace(':5432/', ':6543/');
    if (!connUrl.includes('?')) connUrl += '?pgbouncer=true';
    else if (!connUrl.includes('pgbouncer=true')) connUrl += '&pgbouncer=true';
  }
  pgPool = new Pool({
    connectionString: connUrl,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 2,
    connectionTimeoutMillis: 10000,
  });
  pgPool.on('error', (err: Error) => console.error('[DB POOL] Error:', err.message));
  console.log('[CONFIG] Direct pg pool siap.');
} else {
  console.log('[CONFIG] DATABASE_URL tidak tersedia — pg pool tidak dibuat.');
}

console.log('[CONFIG] Supabase client siap.');

export default supabase;
export { pgPool };
