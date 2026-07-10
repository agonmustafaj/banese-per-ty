-- Lejon përdoruesin të krijojë profilin e vet nëse trigger-i handle_new_user dështon
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (id = auth.uid());
