alter table public.lesson_packages
  add column if not exists payment_due_date date;

comment on column public.lesson_packages.payment_due_date is 'Data prevista para o pagamento do pacote';

create index if not exists lesson_packages_payment_due_date_idx
  on public.lesson_packages(payment_due_date);
