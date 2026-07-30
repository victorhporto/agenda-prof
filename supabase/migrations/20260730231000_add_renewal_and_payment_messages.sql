alter table public.profiles
  add column if not exists msg_renewal text,
  add column if not exists msg_payment_reminder text;

comment on column public.profiles.msg_renewal is 'Template última aula / renovação: {aluno} {total} {pacote} {data}';
comment on column public.profiles.msg_payment_reminder is 'Template lembrete pagamento: {aluno} {pacote} {valor} {valor_pago} {faltante} {data_prevista} {status}';
