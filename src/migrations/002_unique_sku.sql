-- Fix race condition: SKU uniqueness
-- Hapus duplikat SKU dalam user yang sama (jaga data existing)
DELETE FROM products p1
USING (
  SELECT MIN(id) AS id, user_id, sku
  FROM products
  GROUP BY user_id, sku
  HAVING COUNT(*) > 1
) p2
WHERE p1.user_id = p2.user_id
  AND p1.sku = p2.sku
  AND p1.id != p2.id;

-- Tambah unique constraint
ALTER TABLE products
  ADD CONSTRAINT products_user_sku_unique
  UNIQUE (user_id, sku);
