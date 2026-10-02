-- Endereços e coordenadas para estimar deslocamento entre aulas
alter table public.students
  add column address text,
  add column lat double precision check (lat is null or lat between -90 and 90),
  add column lng double precision check (lng is null or lng between -180 and 180);

alter table public.profiles
  add column base_address text,
  add column base_lat double precision check (base_lat is null or base_lat between -90 and 90),
  add column base_lng double precision check (base_lng is null or base_lng between -180 and 180);

alter table public.waitlist_entries
  add column address text,
  add column lat double precision check (lat is null or lat between -90 and 90),
  add column lng double precision check (lng is null or lng between -180 and 180);

comment on column public.students.address is
  'Endereço do aluno, usado para estimar deslocamento em aulas na casa do aluno.';
comment on column public.students.lat is
  'Latitude obtida do endereço via Nominatim (OpenStreetMap).';
comment on column public.profiles.base_address is
  'Ponto de partida do professor (casa), usado na ida à primeira aula e na volta da última.';
comment on column public.waitlist_entries.address is
  'Endereço informado na fila de espera.';
