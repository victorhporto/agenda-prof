-- Preferência de resumo diário por e-mail
alter table public.profiles
  add column if not exists notify_email boolean not null default true;

comment on column public.profiles.notify_email is
  'Receber resumo diário por e-mail (aulas, atrasos, pacotes acabando).';
