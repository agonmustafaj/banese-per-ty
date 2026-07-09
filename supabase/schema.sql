-- Banesë për ty — Supabase schema
-- Ekzekutoni këtë skript në Supabase Dashboard → SQL Editor

-- ── Profiles ──────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null unique,
  role text not null default 'qiramarrësi'
    check (role in ('qiradhënësi', 'qiramarrësi', 'administrator')),
  phone text default '',
  address text default '',
  user_type text default 'employed',
  campus_id text default '',
  two_factor_enabled boolean default false,
  created_at timestamptz default now()
);

-- ── Properties ────────────────────────────────────────────────────────────
create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  address text not null default '',
  city text not null,
  type text default 'apartament',
  rent_price numeric not null default 0,
  deposit numeric default 0,
  rooms int default 1,
  bathrooms int default 1,
  area numeric default 0,
  status text default 'në pritje',
  occupied boolean default false,
  near_campus text default '',
  photos jsonb default '[]'::jsonb,
  amenities jsonb default '{}'::jsonb,
  description text default '',
  reject_reason text,
  created_at date default current_date,
  updated_at timestamptz
);

-- ── Favorites ───────────────────────────────────────────────────────────────
create table if not exists public.favorites (
  user_id uuid references public.profiles(id) on delete cascade,
  property_id uuid references public.properties(id) on delete cascade,
  saved_at timestamptz default now(),
  primary key (user_id, property_id)
);

-- ── Contract requests ───────────────────────────────────────────────────────
create table if not exists public.contract_requests (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references public.properties(id) on delete cascade,
  tenant_id uuid references public.profiles(id) on delete cascade,
  landlord_id uuid references public.profiles(id) on delete cascade,
  status text default 'në pritje',
  contract_id uuid,
  created_at timestamptz default now(),
  resolved_at timestamptz
);

-- ── Contracts ─────────────────────────────────────────────────────────────────
create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references public.properties(id) on delete set null,
  landlord_id uuid references public.profiles(id) on delete set null,
  tenant_id uuid references public.profiles(id) on delete set null,
  request_id uuid references public.contract_requests(id) on delete set null,
  start_date date,
  end_date date,
  status text default 'draft',
  signed_at timestamptz,
  pdf_generated_at timestamptz,
  pdf_url text,
  created_at timestamptz default now(),
  signature jsonb,
  parties_summary text
);

alter table public.contract_requests
  drop constraint if exists contract_requests_contract_id_fkey;
alter table public.contract_requests
  add constraint contract_requests_contract_id_fkey
  foreign key (contract_id) references public.contracts(id) on delete set null;

-- ── Payments ────────────────────────────────────────────────────────────────
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid references public.contracts(id) on delete set null,
  property_id uuid references public.properties(id) on delete set null,
  tenant_id uuid references public.profiles(id) on delete set null,
  landlord_id uuid references public.profiles(id) on delete set null,
  amount numeric not null default 0,
  due_date date,
  status text default 'pending',
  type text default 'qera',
  month text,
  paid_at timestamptz,
  verified_by text,
  dispute_reason text,
  proof jsonb,
  created_at timestamptz default now()
);

-- ── Notifications ───────────────────────────────────────────────────────────
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  type text,
  message text not null,
  read boolean default false,
  sent_at timestamptz default now()
);

-- ── Audit log ───────────────────────────────────────────────────────────────
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  details text,
  created_at timestamptz default now()
);

-- ── Agency requests ─────────────────────────────────────────────────────────
create table if not exists public.agency_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  filters jsonb default '{}'::jsonb,
  status text default 'në pritje',
  created_at timestamptz default now()
);

-- ── Auto-create profile on signup ───────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role, user_type, campus_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'qiramarrësi'),
    coalesce(new.raw_user_meta_data->>'user_type', 'employed'),
    coalesce(new.raw_user_meta_data->>'campus_id', '')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Helper: is admin ────────────────────────────────────────────────────────
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'administrator'
  );
$$;

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.properties enable row level security;
alter table public.favorites enable row level security;
alter table public.contract_requests enable row level security;
alter table public.contracts enable row level security;
alter table public.payments enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_log enable row level security;
alter table public.agency_requests enable row level security;

-- Profiles
create policy "profiles_select" on public.profiles for select using (true);
create policy "profiles_update_own" on public.profiles for update using (id = auth.uid());
create policy "profiles_admin_all" on public.profiles for all using (public.is_admin());

-- Properties
create policy "properties_select_published" on public.properties for select using (
  status = 'publikuar' or owner_id = auth.uid() or public.is_admin()
);
create policy "properties_insert_own" on public.properties for insert with check (owner_id = auth.uid());
create policy "properties_update_own" on public.properties for update using (owner_id = auth.uid() or public.is_admin());
create policy "properties_delete_own" on public.properties for delete using (owner_id = auth.uid() or public.is_admin());

-- Favorites
create policy "favorites_own" on public.favorites for all using (user_id = auth.uid());

-- Contract requests
create policy "contract_requests_parties" on public.contract_requests for all using (
  tenant_id = auth.uid() or landlord_id = auth.uid() or public.is_admin()
);

-- Contracts
create policy "contracts_parties" on public.contracts for all using (
  tenant_id = auth.uid() or landlord_id = auth.uid() or public.is_admin()
);

-- Payments
create policy "payments_parties" on public.payments for all using (
  tenant_id = auth.uid() or landlord_id = auth.uid() or public.is_admin()
);

-- Notifications
create policy "notifications_own" on public.notifications for all using (user_id = auth.uid());

-- Audit log
create policy "audit_insert" on public.audit_log for insert with check (auth.uid() is not null);
create policy "audit_select" on public.audit_log for select using (user_id = auth.uid() or public.is_admin());

-- Fshirje llogarie & pastrim audit (RPC)
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
  from public.profiles where id = target_user_id;
  if target_role is null then
    raise exception 'Përdoruesi nuk u gjet.';
  end if;
  if target_role = 'administrator' then
    raise exception 'Nuk mund të fshini një administrator.';
  end if;
  insert into public.audit_log (user_id, action, details)
  values (admin_id, 'admin_user_deleted', trim(reason) || ' — ' || coalesce(target_email, target_user_id::text));
  delete from auth.users where id = target_user_id;
end;
$$;

revoke all on function public.admin_delete_user(uuid, text) from public;
grant execute on function public.admin_delete_user(uuid, text) to authenticated;

-- Agency requests
create policy "agency_own" on public.agency_requests for all using (user_id = auth.uid() or public.is_admin());

-- ── Storage buckets (krijoni në Dashboard ose përmes API) ───────────────────
-- property-photos  → public
-- payment-proofs   → private
-- contract-signatures → private

insert into storage.buckets (id, name, public)
values ('property-photos', 'property-photos', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('payment-proofs', 'payment-proofs', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('contract-signatures', 'contract-signatures', false)
on conflict (id) do nothing;

-- Storage policies
create policy "property_photos_public_read" on storage.objects for select
  using (bucket_id = 'property-photos');

create policy "property_photos_auth_upload" on storage.objects for insert
  with check (bucket_id = 'property-photos' and auth.uid() is not null);

create policy "property_photos_owner_delete" on storage.objects for delete
  using (bucket_id = 'property-photos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "payment_proofs_parties" on storage.objects for all
  using (bucket_id = 'payment-proofs' and auth.uid() is not null);

create policy "signatures_parties" on storage.objects for all
  using (bucket_id = 'contract-signatures' and auth.uid() is not null);

-- ── Realtime (aktivizoni te Dashboard → Database → Replication) ─────────────
-- alter publication supabase_realtime add table public.notifications;
