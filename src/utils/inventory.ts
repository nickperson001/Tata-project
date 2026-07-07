import { pgPool } from '../config/supabase';
import type { PoolClient } from 'pg';

export async function syncInventory(
  userId: string,
  productId: string,
  quantity: number,
  warehouse = 'Utama',
  client?: PoolClient,
): Promise<void> {
  try {
    const q = `INSERT INTO inventory (user_id, product_id, quantity, warehouse)
               VALUES ($1, $2, $3, $4)
               ON CONFLICT (user_id, product_id, warehouse)
               DO UPDATE SET quantity = EXCLUDED.quantity, updated_at = now()`;
    if (client) {
      await client.query(q, [userId, productId, quantity, warehouse]);
    } else if (pgPool) {
      await pgPool.query(q, [userId, productId, quantity, warehouse]);
    }
  } catch (err: any) {
    console.error(`[INVENTORY] syncInventory error: ${err.message || err}`);
  }
}
