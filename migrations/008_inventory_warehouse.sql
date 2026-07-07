-- Inventory table for multi-warehouse stock tracking
CREATE TABLE IF NOT EXISTS inventory (
  id              bigserial PRIMARY KEY,
  user_id         text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id      bigint NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity        numeric NOT NULL DEFAULT 0,
  warehouse       text NOT NULL DEFAULT 'Utama',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, product_id, warehouse)
);

-- Backfill inventory from existing products.stock_current
INSERT INTO inventory (user_id, product_id, quantity, warehouse)
SELECT user_id, id, stock_current, 'Utama'
FROM products
WHERE stock_current != 0
ON CONFLICT (user_id, product_id, warehouse) DO NOTHING;
