-- Qeramarrësi/qeradhënësi mund të lexojnë pronën kur kanë kontratë ose kërkesë kontrate
drop policy if exists "properties_select_published" on public.properties;

create policy "properties_select_published" on public.properties for select using (
  status = 'publikuar'
  or owner_id = auth.uid()
  or public.is_admin()
  or exists (
    select 1 from public.contracts c
    where c.property_id = properties.id
      and (c.tenant_id = auth.uid() or c.landlord_id = auth.uid())
  )
  or exists (
    select 1 from public.contract_requests r
    where r.property_id = properties.id
      and (r.tenant_id = auth.uid() or r.landlord_id = auth.uid())
  )
);
