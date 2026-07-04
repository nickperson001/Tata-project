-- 003_sales_channels_and_triggers.sql
-- 1. Sales channel configuration (with admin fee %)
-- 2. Trigger to auto-update chart_of_accounts.balance on journal_lines insert
-- 3. Replace post_journal RPC (remove manual balance update — trigger handles it)
-- 4. Materialized view for Laba/Rugi
-- 5. Seed default channels for all users

-- ============================================================
-- PART 1: SALES CHANNELS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS sales_channels (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          VARCHAR(100) NOT NULL,
  coa_code      VARCHAR(10) NOT NULL,
  admin_fee_pct NUMERIC NOT NULL DEFAULT 0 CHECK (admin_fee_pct >= 0 AND admin_fee_pct <= 100),
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, name)
);

-- Seed default channels for a user
CREATE OR REPLACE FUNCTION seed_default_channels(p_user_id TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO sales_channels (user_id, name, coa_code, admin_fee_pct) VALUES
    (p_user_id, 'Offline',     '4101', 0),
    (p_user_id, 'Tokopedia',   '4102', 2),
    (p_user_id, 'TikTok Shop', '4103', 3),
    (p_user_id, 'Lazada',      '4104', 4),
    (p_user_id, 'Shopee',      '4105', 3)
  ON CONFLICT (user_id, name) DO NOTHING;
END;
$$;

-- Auto-seed channels on user insert
CREATE OR REPLACE FUNCTION auto_seed_channels()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM seed_default_channels(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_seed_channels ON users;
CREATE TRIGGER trg_auto_seed_channels
  AFTER INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION auto_seed_channels();

-- Seed channels for existing users
DO $$
DECLARE
  user_rec RECORD;
BEGIN
  FOR user_rec IN SELECT id FROM users LOOP
    PERFORM seed_default_channels(user_rec.id);
  END LOOP;
END;
$$;

-- ============================================================
-- PART 2: BALANCE UPDATE TRIGGER ON journal_lines
-- ============================================================
CREATE OR REPLACE FUNCTION fn_update_coa_balance_on_journal_line_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id         TEXT;
  v_normal_balance  TEXT;
  v_change          NUMERIC;
BEGIN
  SELECT je.user_id INTO v_user_id
  FROM journal_entries je
  WHERE je.id = NEW.entry_id;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Journal entry % not found', NEW.entry_id;
  END IF;

  SELECT normal_balance INTO v_normal_balance
  FROM chart_of_accounts
  WHERE user_id = v_user_id AND code = NEW.account_code;

  IF v_normal_balance IS NULL THEN
    RAISE EXCEPTION 'Akun % tidak ditemukan untuk user %', NEW.account_code, v_user_id;
  END IF;

  v_change := COALESCE(NEW.debit, 0) - COALESCE(NEW.credit, 0);
  IF v_normal_balance = 'credit' THEN
    v_change := -v_change;
  END IF;

  UPDATE chart_of_accounts
  SET balance = balance + v_change,
      updated_at = now()
  WHERE user_id = v_user_id AND code = NEW.account_code;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_journal_lines_balance ON journal_lines;
CREATE TRIGGER trg_journal_lines_balance
  AFTER INSERT ON journal_lines
  FOR EACH ROW
  EXECUTE FUNCTION fn_update_coa_balance_on_journal_line_insert();

-- ============================================================
-- PART 3: REPLACE post_journal — remove manual balance update
--          (trigger handles it)
-- ============================================================
CREATE OR REPLACE FUNCTION post_journal(
  p_user_id         TEXT,
  p_entry_date      DATE,
  p_reference_type  TEXT,
  p_reference_id    TEXT,
  p_description     TEXT,
  p_lines           JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_journal_id   UUID;
  v_line         JSONB;
  v_total_debit  NUMERIC := 0;
  v_total_credit NUMERIC := 0;
  v_account_name TEXT;
BEGIN
  SELECT SUM((l->>'debit')::NUMERIC), SUM((l->>'credit')::NUMERIC)
  INTO v_total_debit, v_total_credit
  FROM jsonb_array_elements(p_lines) AS l;

  IF v_total_debit IS DISTINCT FROM v_total_credit THEN
    RAISE EXCEPTION 'Debit (%) tidak sama dengan Credit (%)', v_total_debit, v_total_credit;
  END IF;

  INSERT INTO journal_entries (user_id, entry_date, reference_type, reference_id, description, channel, is_posted)
  VALUES (p_user_id, p_entry_date, p_reference_type, p_reference_id, p_description, 'Offline', true)
  RETURNING id INTO v_journal_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    SELECT name INTO v_account_name
    FROM chart_of_accounts
    WHERE user_id = p_user_id AND code = (v_line->>'account_code');

    IF v_account_name IS NULL THEN
      RAISE EXCEPTION 'Akun % tidak ditemukan', (v_line->>'account_code');
    END IF;

    INSERT INTO journal_lines (entry_id, account_code, debit, credit, description)
    VALUES (
      v_journal_id,
      v_line->>'account_code',
      COALESCE((v_line->>'debit')::NUMERIC, 0),
      COALESCE((v_line->>'credit')::NUMERIC, 0),
      COALESCE(v_line->>'description', '')
    );
    -- Balance update handled by trigger trg_journal_lines_balance
  END LOOP;

  RETURN v_journal_id;
END;
$$;

-- ============================================================
-- PART 4: MATERIALIZED VIEW FOR LABA/RUGI
-- ============================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_laba_rugi AS
SELECT
  je.user_id,
  DATE_TRUNC('month', je.entry_date) AS bulan,
  coa.type   AS account_type,
  coa.code   AS account_code,
  coa.name   AS account_name,
  SUM(jl.debit)  AS total_debit,
  SUM(jl.credit) AS total_credit
FROM journal_entries je
JOIN journal_lines jl ON jl.entry_id = je.id
JOIN chart_of_accounts coa ON coa.code = jl.account_code AND coa.user_id = je.user_id
WHERE je.is_posted = true
GROUP BY je.user_id, DATE_TRUNC('month', je.entry_date), coa.type, coa.code, coa.name
ORDER BY je.user_id, DATE_TRUNC('month', je.entry_date), coa.code;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_laba_rugi_pk
  ON mv_laba_rugi (user_id, bulan, account_code);

CREATE OR REPLACE FUNCTION refresh_mv_laba_rugi()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_laba_rugi;
END;
$$;

-- Auto-refresh MV when new journal lines are inserted
CREATE OR REPLACE FUNCTION fn_refresh_mv_laba_rugi_on_journal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_laba_rugi;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_refresh_mv_laba_rugi ON journal_lines;
CREATE TRIGGER trg_refresh_mv_laba_rugi
  AFTER INSERT ON journal_lines
  FOR EACH STATEMENT
  EXECUTE FUNCTION fn_refresh_mv_laba_rugi_on_journal();

-- ============================================================
-- PART 5: GRANTS
-- ============================================================
GRANT ALL ON sales_channels TO service_role;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE ON SEQUENCES TO service_role, anon, authenticated;
