-- Lejo administratorin të fshijë regjistrime individuale nga audit log
create policy "audit_delete_admin" on public.audit_log
  for delete using (public.is_admin());
