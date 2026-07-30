-- Customizable WhatsApp message templates per teacher
alter table public.profiles
  add column if not exists msg_completed text,
  add column if not exists msg_missed text,
  add column if not exists msg_rescheduled text;

comment on column public.profiles.msg_completed is 'Template: {aluno} {n} {total} {data} {restantes}';
comment on column public.profiles.msg_missed is 'Template: {aluno} {data}';
comment on column public.profiles.msg_rescheduled is 'Template: {aluno} {data_antiga} {data_nova}';
