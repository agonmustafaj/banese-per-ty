-- Numër natyror i kontratës + nënshkrimi i qeradhënësit
alter table public.contracts add column if not exists contract_number integer;
alter table public.contracts add column if not exists landlord_signature jsonb;

create unique index if not exists contracts_contract_number_key
  on public.contracts (contract_number)
  where contract_number is not null;
