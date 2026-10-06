-- Enable RLS on ccm_cadastros_historico_mensal.
--
-- This table is only accessed through the security-definer function
-- get_casados_dashboard(), which runs as the postgres role and bypasses RLS.
-- Direct client access (anon / authenticated) is intentionally blocked.
-- All writes must go through a service-role API route.
--
-- Note: a stray policy 'admin_master_full_access' may exist on the remote
-- from a manual dashboard action. We drop it here to enforce a clean state —
-- no permissive policies are needed since all reads go through the
-- security-definer function.

drop policy if exists "admin_master_full_access" on public.ccm_cadastros_historico_mensal;

alter table public.ccm_cadastros_historico_mensal enable row level security;
