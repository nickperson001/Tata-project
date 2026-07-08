-- ============================================================
-- OPTIMASI DATABASE — UNIQUE CONSTRAINTS + INDEXES + BACKFILL
-- ============================================================
-- Run this in Supabase SQL Editor

-- 1. HAPUS DUPLIKAT sebelum ADD UNIQUE (biar tidak error)
DELETE FROM inventory a USING inventory b
WHERE a.id < b.id
  AND a.user_id = b.user_id
  AND a.product_id = b.product_id
  AND a.warehouse = b.warehouse;

DELETE FROM warehouses a USING warehouses b
WHERE a.id < b.id
  AND a.user_id = b.user_id
  AND a.code = b.code;

-- 2. UNIQUE CONSTRAINTS
ALTER TABLE inventory ADD UNIQUE (user_id, product_id, warehouse);
ALTER TABLE warehouses ADD UNIQUE (user_id, code);

-- 3. INDEXES (performa query)
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
CREATE INDEX IF NOT EXISTS idx_debts_user ON debts(user_id, status_lunas);
CREATE INDEX IF NOT EXISTS idx_product_categories_user ON product_categories(user_id);
CREATE INDEX IF NOT EXISTS idx_inventory_lookup ON inventory(user_id, product_id, warehouse);
CREATE INDEX IF NOT EXISTS idx_stock_alerts_user ON stock_alerts(user_id, resolved_at);
CREATE INDEX IF NOT EXISTS idx_settings_lookup ON settings(key);

-- 4. BACKFILL — inventory dari products yg punya stok
INSERT INTO inventory (user_id, product_id, quantity, warehouse)
SELECT p.user_id, p.id, p.stock_current, 'Utama'
FROM products p
WHERE p.stock_current != 0
  AND NOT EXISTS (
    SELECT 1 FROM inventory i
    WHERE i.user_id = p.user_id AND i.product_id = p.id AND i.warehouse = 'Utama'
  );

-- 5. BACKFILL — payables dari accounts_payable (tabel lama)
INSERT INTO payables (id, user_id, nama_supplier, nominal_hutang, jumlah_dibayar, status_lunas, jatuh_tempo, deskripsi, transaction_id, created_at)
SELECT a.id, a.user_id, a.nama_supplier, a.nominal_hutang, a.jumlah_dibayar, a.status_lunas, a.jatuh_tempo, a.deskripsi, NULL, a.created_at
FROM accounts_payable a
WHERE NOT EXISTS (SELECT 1 FROM payables p WHERE p.id = a.id);

-- 6. BACKFILL — receivables dari debts (tabel lama)
INSERT INTO receivables (id, user_id, transaction_id, nama_pelanggan, nominal_piutang, status_lunas, jatuh_tempo, created_at)
SELECT d.id, d.user_id, d.transaction_id, d.nama_pelanggan, d.nominal_piutang, d.status_lunas, d.jatuh_tempo, d.created_at
FROM debts d
WHERE NOT EXISTS (SELECT 1 FROM receivables r WHERE r.id = d.id);
