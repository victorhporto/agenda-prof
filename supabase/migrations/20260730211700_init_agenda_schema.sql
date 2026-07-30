-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Students
create table public.students (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  phone text,
  notes text,
  created_at timestamptz not null default now()
);

create index students_teacher_id_idx on public.students(teacher_id);

alter table public.students enable row level security;

create policy "Teachers manage own students"
  on public.students for all
  using (auth.uid() = teacher_id)
  with check (auth.uid() = teacher_id);

-- Lesson packages
create table public.lesson_packages (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  title text not null,
  total_lessons int not null check (total_lessons > 0),
  price numeric(10,2),
  status text not null default 'active' check (status in ('active', 'closed')),
  created_at timestamptz not null default now()
);

create index lesson_packages_teacher_id_idx on public.lesson_packages(teacher_id);
create index lesson_packages_student_id_idx on public.lesson_packages(student_id);

alter table public.lesson_packages enable row level security;

create policy "Teachers manage own packages"
  on public.lesson_packages for all
  using (auth.uid() = teacher_id)
  with check (auth.uid() = teacher_id);

-- Lessons
create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  package_id uuid not null references public.lesson_packages(id) on delete cascade,
  scheduled_at timestamptz not null,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'completed', 'missed', 'cancelled', 'rescheduled')),
  sequence_number int,
  notes text,
  rescheduled_from_id uuid references public.lessons(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index lessons_teacher_id_idx on public.lessons(teacher_id);
create index lessons_package_id_idx on public.lessons(package_id);
create index lessons_scheduled_at_idx on public.lessons(scheduled_at);
create index lessons_status_idx on public.lessons(status);

alter table public.lessons enable row level security;

create policy "Teachers manage own lessons"
  on public.lessons for all
  using (auth.uid() = teacher_id)
  with check (auth.uid() = teacher_id);
