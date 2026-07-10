-- ════════════════════════════════════════════════════════════
-- Migration 015: Tambah product_id di bom_recipes
-- ════════════════════════════════════════════════════════════
-- Kolom NULL = resep berlaku untuk SEMUA produk (backward compat)
-- Kolom terisi = resep spesifik untuk produk tertentu
-- ════════════════════════════════════════════════════════════

ALTER TABLE bom_recipes ADD COLUMN IF NOT EXISTS product_id bigint REFERENCES products(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_br_product ON bom_recipes(product_id);
