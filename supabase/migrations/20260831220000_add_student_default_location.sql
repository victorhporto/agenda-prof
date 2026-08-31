alter table public.students
  add column default_location text
  check (
    default_location is null
    or default_location in ('casa_aluno', 'casa_professor', 'online')
  );

comment on column public.students.default_location is
  'Local padrão das aulas deste aluno. A aula pode sobrescrever em lessons.location.';
