-- Ekzekutoni në Supabase SQL Editor
-- Pastron audit log pas hyrjes/daljes nga webapp

create or replace function public.clear_audit_log()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.audit_log;
end;
$$;

revoke all on function public.clear_audit_log() from public;
grant execute on function public.clear_audit_log() to authenticated;
