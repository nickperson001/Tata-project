-- 001_categories_and_channel.sql
-- Run via SQL Editor (Supabase Dashboard -> SQL Editor)
-- Menambahkan tabel kategori produk & kolom default_channel ke products

CREATE TABLE IF NOT EXISTS product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pcat_user_name
  ON product_categories (user_id, name);

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS default_channel VARCHAR(50);

-- Fix sequence permissions for all bigserial tables
-- Prevents "permission denied for sequence" errors
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE ON SEQUENCES TO service_role, anon, authenticated;
