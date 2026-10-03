-- Horário semanal reservado do aluno: a grade "ideal", sem remarcações ou reposições.
-- Formato: [{ "weekday": 1-7 (ISO, 1 = segunda), "time": "HH:MM" }]
alter table public.students
  add column if not exists reserved_slots jsonb not null default '[]'::jsonb;

alter table public.students
  drop constraint if exists students_reserved_slots_is_array;

alter table public.students
  add constraint students_reserved_slots_is_array
  check (jsonb_typeof(reserved_slots) = 'array');

comment on column public.students.reserved_slots is
  'Horários semanais reservados: [{weekday 1-7, time HH:MM}]';
