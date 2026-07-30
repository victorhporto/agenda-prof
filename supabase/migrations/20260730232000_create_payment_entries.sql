-- Payment entry history for packages
create table if not exists public.payment_entries (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.lesson_packages(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(10,2) not null check (amount > 0),
  paid_at date not null default current_date,
  method text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists payment_entries_package_id_idx on public.payment_entries(package_id);
create index if not exists payment_entries_teacher_id_idx on public.payment_entries(teacher_id);

alter table public.payment_entries enable row level security;

create policy "Teachers manage own payment entries"
  on public.payment_entries for all
  using (auth.uid() = teacher_id)
  with check (auth.uid() = teacher_id);

insert into public.payment_entries (package_id, teacher_id, amount, paid_at, notes)
select
  id,
  teacher_id,
  amount_paid,
  coalesce((paid_at at time zone 'UTC')::date, current_date),
  'Registro inicial'
from public.lesson_packages
where amount_paid > 0
  and not exists (
    select 1 from public.payment_entries pe where pe.package_id = lesson_packages.id
  );
