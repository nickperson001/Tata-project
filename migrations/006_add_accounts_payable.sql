-- ============================================================
-- Migration 006: Add accounts_payable (Hutang ke Supplier)
-- Execute di Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS accounts_payable (
  id              bigserial PRIMARY KEY,
  user_id         text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nama_supplier   text NOT NULL,
  nominal_hutang  numeric NOT NULL DEFAULT 0,
  jumlah_dibayar  numeric NOT NULL DEFAULT 0,
  status_lunas    boolean NOT NULL DEFAULT false,
  jatuh_tempo     timestamptz,
  deskripsi       text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ap_user ON accounts_payable(user_id);
CREATE INDEX IF NOT EXISTS idx_ap_jatuh_tempo ON accounts_payable(user_id, jatuh_tempo) WHERE status_lunas = false;

ALTER TABLE accounts_payable ENABLE ROW LEVEL SECURITY;
CREATE POLICY ap_user_scope ON accounts_payable
  FOR ALL
  USING (user_id = current_setting('app.user_id', true));

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_ap_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ap_updated_at ON accounts_payable;
CREATE TRIGGER trg_ap_updated_at
  BEFORE UPDATE ON accounts_payable
  FOR EACH ROW
  EXECUTE FUNCTION update_ap_updated_at();

-- Sync to 000_full_schema.sql also
