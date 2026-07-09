-- EKZEKUTONI VETËM KËTË nëse databaza ekziston tashmë.
-- Mos ekzekutoni schema.sql të plotë përsëri — policies/tabelat janë krijuar.

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

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Nuk jeni i autentifikuar.';
  end if;
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.clear_audit_log() from public;
grant execute on function public.clear_audit_log() to authenticated;
revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;
