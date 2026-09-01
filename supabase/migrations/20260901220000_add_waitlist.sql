-- Fila de espera de alunos ainda não cadastrados na agenda
create table public.waitlist_entries (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  contact text not null,
  location text not null
    check (location in ('casa_aluno', 'casa_professor', 'online')),
  available_slots jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index waitlist_entries_teacher_created_idx
  on public.waitlist_entries (teacher_id, created_at);

alter table public.waitlist_entries enable row level security;

create policy "Teachers manage own waitlist"
  on public.waitlist_entries for all
  using (auth.uid() = teacher_id)
  with check (auth.uid() = teacher_id);

comment on table public.waitlist_entries is
  'Alunos na fila de espera, em ordem de chegada (created_at).';
comment on column public.waitlist_entries.available_slots is
  'Horários do aluno: [{ weekday: 1-7, time: "HH:mm" }].';
comment on column public.waitlist_entries.contact is
  'WhatsApp, telefone ou e-mail informado na fila.';
