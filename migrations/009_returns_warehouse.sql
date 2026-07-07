-- ============================================
-- Phase 1 & 4: Returns Support & Warehouses
-- ============================================

-- 1. Add discount & return fields to transactions
ALTER TABLE transactions 
  ADD COLUMN IF NOT EXISTS discount_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_type text,
  ADD COLUMN IF NOT EXISTS return_reason text,
  ADD COLUMN IF NOT EXISTS original_transaction_id bigint REFERENCES transactions(id) ON DELETE SET NULL;

-- 2. Add return reference types to stock_movements
ALTER TABLE stock_movements
  ADD COLUMN IF NOT EXISTS from_warehouse text,
  ADD COLUMN IF NOT EXISTS to_warehouse text;

-- 3. Warehouses table
CREATE TABLE IF NOT EXISTS warehouses (
  id              bigserial PRIMARY KEY,
  user_id         text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            text NOT NULL,
  code            text NOT NULL,
  is_default      boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, code)
);

-- Seed default warehouse for existing users
INSERT INTO warehouses (user_id, name, code, is_default)
SELECT DISTINCT id, 'Utama', 'MAIN', true FROM users
ON CONFLICT DO NOTHING;

-- 4. Stock opname tables (Phase 2)
CREATE TABLE IF NOT EXISTS stock_opnames (
  id              bigserial PRIMARY KEY,
  user_id         text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  opname_date     timestamptz NOT NULL DEFAULT now(),
  status          text NOT NULL DEFAULT 'draft',
  warehouse       text NOT NULL DEFAULT 'Utama',
  notes           text,
  created_by      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  completed_at    timestamptz,
  CONSTRAINT valid_opname_status CHECK (status IN ('draft', 'in_progress', 'completed', 'cancelled'))
);

CREATE TABLE IF NOT EXISTS opname_details (
  id              bigserial PRIMARY KEY,
  opname_id       bigint NOT NULL REFERENCES stock_opnames(id) ON DELETE CASCADE,
  product_id      bigint NOT NULL REFERENCES products(id),
  system_qty      numeric NOT NULL,
  actual_qty      numeric NOT NULL,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- 5. COA accounts for returns & adjustments
INSERT INTO chart_of_accounts (code, name, type, description, is_system)
VALUES 
  ('4102', 'Retur Penjualan', 'revenue', 'Contra-revenue untuk retur penjualan (customer return)', true),
  ('4103', 'Diskon Penjualan', 'revenue', 'Contra-revenue untuk diskon penjualan', true),
  ('4104', 'Keuntungan Persediaan', 'revenue', 'Keuntungan dari inventory overage / selisih opname', true),
  ('6101', 'Kerugian Persediaan', 'expense', 'Kerugian inventory shortage / selisih opname', true)
ON CONFLICT (code) DO NOTHING;
