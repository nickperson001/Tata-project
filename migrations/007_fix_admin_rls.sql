-- ============================================================
-- Fix admin RLS — bypass via SECURITY DEFINER function
-- RLS policy admin_select_own pada admins menggunakan
-- current_setting('app.admin_email', true) yang TIDAK PERNAH
-- diset dari Supabase anon key → query selalu return 0 row.
-- Solusi: RPC function dengan SECURITY DEFINER (bypass RLS).
-- ============================================================

CREATE OR REPLACE FUNCTION get_admin_by_email(p_email text)
RETURNS TABLE (email text, password_hash text, role text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT a.email, a.password_hash, a.role
  FROM admins a
  WHERE a.email = p_email;
END;
$$;
