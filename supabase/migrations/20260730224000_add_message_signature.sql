-- Optional signature appended to all messages
alter table public.profiles
  add column if not exists msg_signature text,
  add column if not exists msg_signature_enabled boolean not null default false;

comment on column public.profiles.msg_signature is 'Texto anexado ao final de todas as mensagens quando habilitado';
comment on column public.profiles.msg_signature_enabled is 'Se true, anexa msg_signature ao final das mensagens';
