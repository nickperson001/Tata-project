-- ============================================
-- Migration 010: Rename accounting tables
-- Code references 'payables' and 'receivables'
-- but old migrations created 'accounts_payable' and 'debts'
-- ============================================

-- 1. Create payables (matching accounts_payable schema)
CREATE TABLE IF NOT EXISTS payables (
  id              bigserial PRIMARY KEY,
  user_id         text NOT NULL,
  nama_supplier   text NOT NULL,
  nominal_hutang  numeric NOT NULL DEFAULT 0,
  jumlah_dibayar  numeric NOT NULL DEFAULT 0,
  status_lunas    boolean NOT NULL DEFAULT false,
  jatuh_tempo     timestamptz,
  deskripsi       text DEFAULT '',
  transaction_id  bigint,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Copy data from accounts_payable if it exists
INSERT INTO payables (id, user_id, nama_supplier, nominal_hutang, jumlah_dibayar, status_lunas, jatuh_tempo, deskripsi, created_at)
SELECT id, user_id, nama_supplier, nominal_hutang, jumlah_dibayar, status_lunas, jatuh_tempo, deskripsi, created_at
FROM accounts_payable
WHERE NOT EXISTS (SELECT 1 FROM payables WHERE payables.id = accounts_payable.id);

-- 2. Create receivables (matching debts schema)
CREATE TABLE IF NOT EXISTS receivables (
  id              bigserial PRIMARY KEY,
  user_id         text NOT NULL,
  transaction_id  bigint,
  nama_pelanggan  text NOT NULL,
  nominal_piutang numeric NOT NULL DEFAULT 0,
  status_lunas    boolean NOT NULL DEFAULT false,
  jatuh_tempo     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Copy data from debts if it exists
INSERT INTO receivables (id, user_id, transaction_id, nama_pelanggan, nominal_piutang, status_lunas, jatuh_tempo, created_at)
SELECT id, user_id, transaction_id, nama_pelanggan, nominal_piutang, status_lunas, jatuh_tempo, created_at
FROM debts
WHERE NOT EXISTS (SELECT 1 FROM receivables WHERE receivables.id = debts.id);
