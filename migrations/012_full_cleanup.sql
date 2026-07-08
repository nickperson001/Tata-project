-- ============================================================
-- MIGRATION 012 — FULL OPTIMIZATION & CLEANUP
-- ============================================================
-- Run this ONCE in Supabase SQL Editor (idempoten — aman di-run ulang)

-- ============================================================
-- BAGIAN 1: HAPUS DUPLIKAT
-- ============================================================
DELETE FROM inventory a USING inventory b
WHERE a.id < b.id
  AND a.user_id = b.user_id
  AND a.product_id = b.product_id
  AND a.warehouse = b.warehouse;

DELETE FROM warehouses a USING warehouses b
WHERE a.id < b.id
  AND a.user_id = b.user_id
  AND a.code = b.code;

-- ============================================================
-- BAGIAN 2: UNIQUE CONSTRAINTS
-- ============================================================
ALTER TABLE inventory ADD UNIQUE (user_id, product_id, warehouse);
ALTER TABLE warehouses ADD UNIQUE (user_id, code);

-- ============================================================
-- BAGIAN 3: INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_products_user_id ON products(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(user_id, type);
CREATE INDEX IF NOT EXISTS idx_stock_movements_user_id ON stock_movements(user_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_type ON stock_movements(user_id, type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_journal_entries_user ON journal_entries(user_id, entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_journal_lines_entry ON journal_lines(entry_id);
CREATE INDEX IF NOT EXISTS idx_coa_user ON chart_of_accounts(user_id, code);
CREATE INDEX IF NOT EXISTS idx_payables_user ON payables(user_id, status_lunas);
CREATE INDEX IF NOT EXISTS idx_receivables_user ON receivables(user_id, status_lunas);
CREATE INDEX IF NOT EXISTS idx_product_categories_user ON product_categories(user_id);
CREATE INDEX IF NOT EXISTS idx_inventory_lookup ON inventory(user_id, product_id, warehouse);
CREATE INDEX IF NOT EXISTS idx_stock_alerts_user ON stock_alerts(user_id, resolved_at);
CREATE INDEX IF NOT EXISTS idx_settings_lookup ON settings(key);

-- ============================================================
-- BAGIAN 4: BACKFILL DATA KE TABEL BARU
-- ============================================================
INSERT INTO inventory (user_id, product_id, quantity, warehouse)
SELECT p.user_id, p.id, p.stock_current, 'Utama'
FROM products p
WHERE p.stock_current != 0
  AND NOT EXISTS (
    SELECT 1 FROM inventory i
    WHERE i.user_id = p.user_id AND i.product_id = p.id AND i.warehouse = 'Utama'
  );

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'accounts_payable') THEN
    INSERT INTO payables (id, user_id, nama_supplier, nominal_hutang, jumlah_dibayar, status_lunas, jatuh_tempo, deskripsi, transaction_id, created_at)
    SELECT a.id, a.user_id, a.nama_supplier, a.nominal_hutang, a.jumlah_dibayar, a.status_lunas, a.jatuh_tempo, a.deskripsi, NULL, a.created_at
    FROM accounts_payable a
    WHERE NOT EXISTS (SELECT 1 FROM payables p WHERE p.id = a.id);
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'debts') THEN
    INSERT INTO receivables (id, user_id, transaction_id, nama_pelanggan, nominal_piutang, status_lunas, jatuh_tempo, created_at)
    SELECT d.id, d.user_id, d.transaction_id, d.nama_pelanggan, d.nominal_piutang, d.status_lunas, d.jatuh_tempo, d.created_at
    FROM debts d
    WHERE NOT EXISTS (SELECT 1 FROM receivables r WHERE r.id = d.id);
  END IF;
END $$;

-- ============================================================
-- BAGIAN 5: DROP TABEL LAMA (hanya jika masih ada)
-- ============================================================
DROP TABLE IF EXISTS accounts_payable CASCADE;
DROP TABLE IF EXISTS debts CASCADE;

-- ============================================================
-- BAGIAN 6: DROP KOLOM MATI
-- ============================================================
ALTER TABLE transactions DROP COLUMN IF EXISTS discount_amount;
ALTER TABLE transactions DROP COLUMN IF EXISTS discount_type;

ALTER TABLE products DROP COLUMN IF EXISTS price_grosir;
ALTER TABLE products DROP COLUMN IF EXISTS min_qty_grosir;

-- ============================================================
-- BAGIAN 7: KONSOLIDASI BANK — pindah dari users ke user_profiles
-- ============================================================

-- 7a. Backfill bank data dari users ke user_profiles
INSERT INTO user_profiles (user_id, bank_name, bank_account, bank_holder)
SELECT u.id, u.bank_name, u.bank_account, u.bank_holder
FROM users u
WHERE (u.bank_name IS NOT NULL OR u.bank_account IS NOT NULL OR u.bank_holder IS NOT NULL)
  AND NOT EXISTS (SELECT 1 FROM user_profiles up WHERE up.user_id = u.id);

-- 7b. Update user_profiles jika users punya data lebih baru
UPDATE user_profiles up
SET
  bank_name    = COALESCE(up.bank_name, u.bank_name),
  bank_account = COALESCE(up.bank_account, u.bank_account),
  bank_holder  = COALESCE(up.bank_holder, u.bank_holder)
FROM users u
WHERE up.user_id = u.id
  AND (u.bank_name IS NOT NULL OR u.bank_account IS NOT NULL OR u.bank_holder IS NOT NULL);

-- 7c. Drop kolom bank dari users (sekarang cuma di user_profiles)
ALTER TABLE users DROP COLUMN IF EXISTS bank_name;
ALTER TABLE users DROP COLUMN IF EXISTS bank_account;
ALTER TABLE users DROP COLUMN IF EXISTS bank_holder;

-- 7d. Buat RPC upsert_user_profile agar code path primary bekerja
CREATE OR REPLACE FUNCTION upsert_user_profile(
  p_user_id TEXT,
  p_bank_name TEXT DEFAULT NULL,
  p_bank_account TEXT DEFAULT NULL,
  p_bank_holder TEXT DEFAULT NULL,
  p_admin_wa_number TEXT DEFAULT NULL
) RETURNS void AS $$
BEGIN
  INSERT INTO user_profiles (user_id, bank_name, bank_account, bank_holder, admin_wa_number)
  VALUES (p_user_id, p_bank_name, p_bank_account, p_bank_holder, p_admin_wa_number)
  ON CONFLICT (user_id) DO UPDATE SET
    bank_name        = COALESCE(EXCLUDED.bank_name, user_profiles.bank_name),
    bank_account     = COALESCE(EXCLUDED.bank_account, user_profiles.bank_account),
    bank_holder      = COALESCE(EXCLUDED.bank_holder, user_profiles.bank_holder),
    admin_wa_number  = COALESCE(EXCLUDED.admin_wa_number, user_profiles.admin_wa_number);
END;
$$ LANGUAGE plpgsql;
