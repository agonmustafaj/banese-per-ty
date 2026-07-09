-- Aktivizo Supabase Realtime për përditësim automatik në aplikacion
alter publication supabase_realtime add table public.properties;
alter publication supabase_realtime add table public.contracts;
alter publication supabase_realtime add table public.contract_requests;
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.payments;
