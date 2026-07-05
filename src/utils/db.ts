import { pgPool } from '../config/supabase';
import type { PoolClient } from 'pg';

export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  if (!pgPool) {
    throw new Error('DATABASE_URL tidak tersedia — koneksi database langsung tidak bisa digunakan');
  }
  const client = await pgPool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
