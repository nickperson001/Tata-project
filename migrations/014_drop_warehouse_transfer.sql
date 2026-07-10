-- ════════════════════════════════════════════════════════════
-- Migration 014: Hapus fitur Transfer Gudang
-- ════════════════════════════════════════════════════════════
-- Dijalankan manual via SQL editor (Supabase Dashboard)
-- ════════════════════════════════════════════════════════════

-- 1. Hapus data transfer yang sudah ada (opsional — kalau mau bersih)
-- DELETE FROM stock_movements WHERE reference_type = 'warehouse_transfer';

-- 2. Hapus kolom from_warehouse / to_warehouse dari stock_movements
ALTER TABLE stock_movements DROP COLUMN IF EXISTS from_warehouse;
ALTER TABLE stock_movements DROP COLUMN IF EXISTS to_warehouse;

-- 3. Hapus tabel warehouses
DROP TABLE IF EXISTS warehouses;

-- 4. Hapus semua baris di inventory yang bukan warehouse 'Utama'
--    (data transfer mungkin ada di warehouse lain)
-- DELETE FROM inventory WHERE warehouse != 'Utama';
