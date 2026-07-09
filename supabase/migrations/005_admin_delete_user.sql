-- Ekzekutoni në Supabase SQL Editor
-- Lejon administratorin të fshijë përdorues me arsye të detyrueshme

create or replace function public.admin_delete_user(target_user_id uuid, reason text)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  admin_id uuid := auth.uid();
  target_role text;
  target_email text;
begin
  if admin_id is null then
    raise exception 'Nuk jeni i autentifikuar.';
  end if;

  if not public.is_admin() then
    raise exception 'Vetëm administratori mund të fshijë përdorues.';
  end if;

  if target_user_id is null then
    raise exception 'Përdoruesi nuk u specifikua.';
  end if;

  if admin_id = target_user_id then
    raise exception 'Nuk mund të fshini llogarinë tuaj nga këtu.';
  end if;

  if reason is null or length(trim(reason)) < 5 then
    raise exception 'Arsyeja e fshirjes duhet të ketë të paktën 5 karaktere.';
  end if;

  select role, email into target_role, target_email
  from public.profiles
  where id = target_user_id;

  if target_role is null then
    raise exception 'Përdoruesi nuk u gjet.';
  end if;

  if target_role = 'administrator' then
    raise exception 'Nuk mund të fshini një administrator.';
  end if;

  insert into public.audit_log (user_id, action, details)
  values (
    admin_id,
    'admin_user_deleted',
    trim(reason) || ' — ' || coalesce(target_email, target_user_id::text)
  );

  delete from auth.users where id = target_user_id;
end;
$$;

revoke all on function public.admin_delete_user(uuid, text) from public;
grant execute on function public.admin_delete_user(uuid, text) to authenticated;
