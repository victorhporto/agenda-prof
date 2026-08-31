alter table public.lessons
  add column location text
  check (location is null or location in ('casa_aluno', 'casa_professor', 'online'));
