-- Endereço em campos (CEP, rua, número, complemento, bairro, cidade, UF).
-- As colunas de texto address/base_address continuam como o endereço montado
-- para exibição; lat/lng seguem sendo a localização usada no deslocamento.

alter table public.students
  add column address_parts jsonb
    check (address_parts is null or jsonb_typeof(address_parts) = 'object');

alter table public.waitlist_entries
  add column address_parts jsonb
    check (address_parts is null or jsonb_typeof(address_parts) = 'object');

alter table public.profiles
  add column base_address_parts jsonb
    check (base_address_parts is null or jsonb_typeof(base_address_parts) = 'object');

comment on column public.students.address_parts is
  'Endereço em campos: {cep, street, number, complement, neighborhood, city, state}.';
comment on column public.waitlist_entries.address_parts is
  'Endereço em campos: {cep, street, number, complement, neighborhood, city, state}.';
comment on column public.profiles.base_address_parts is
  'Ponto de partida em campos: {cep, street, number, complement, neighborhood, city, state}.';
