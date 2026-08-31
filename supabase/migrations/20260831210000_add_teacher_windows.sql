alter table public.profiles
  add column teacher_windows jsonb;

comment on column public.profiles.teacher_windows is
  'Horários permanentes do professor: [{weekday: 1-7, start: HH:mm, end: HH:mm}]. null = padrão segunda a sexta, 10h–20h.';
