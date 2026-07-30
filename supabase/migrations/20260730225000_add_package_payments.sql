-- Payment tracking on packages
alter table public.lesson_packages
  add column if not exists payment_status text not null default 'pending'
    check (payment_status in ('pending', 'partial', 'paid')),
  add column if not exists amount_paid numeric(10,2) not null default 0
    check (amount_paid >= 0),
  add column if not exists paid_at timestamptz,
  add column if not exists payment_notes text;

create index if not exists lesson_packages_payment_status_idx
  on public.lesson_packages(payment_status);
