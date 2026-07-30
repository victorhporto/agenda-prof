import Link from "next/link";
import {
  addDays,
  endOfDay,
  format,
  parseISO,
  startOfDay,
  startOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { createClient } from "@/lib/supabase/server";
import { formatLessonDate, statusLabel } from "@/lib/utils";

type SearchParams = Promise<{ dia?: string; view?: string }>;

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const view = params.view === "semana" ? "semana" : "dia";
  const baseDate = params.dia ? parseISO(params.dia) : new Date();
  const dayKey = format(baseDate, "yyyy-MM-dd");

  const rangeStart =
    view === "semana"
      ? startOfWeek(baseDate, { weekStartsOn: 1 })
      : startOfDay(baseDate);
  const rangeEnd =
    view === "semana"
      ? endOfDay(addDays(rangeStart, 6))
      : endOfDay(baseDate);

  const prev =
    view === "semana"
      ? format(addDays(rangeStart, -7), "yyyy-MM-dd")
      : format(addDays(baseDate, -1), "yyyy-MM-dd");
  const next =
    view === "semana"
      ? format(addDays(rangeStart, 7), "yyyy-MM-dd")
      : format(addDays(baseDate, 1), "yyyy-MM-dd");

  const supabase = await createClient();
  const { data: lessons } = await supabase
    .from("lessons")
    .select(
      `
      id,
      scheduled_at,
      status,
      sequence_number,
      lesson_packages (
        title,
        total_lessons,
        students ( name )
      )
    `,
    )
    .gte("scheduled_at", rangeStart.toISOString())
    .lte("scheduled_at", rangeEnd.toISOString())
    .order("scheduled_at", { ascending: true });

  const title =
    view === "semana"
      ? `Semana de ${format(rangeStart, "dd/MM", { locale: ptBR })}`
      : format(baseDate, "EEEE, dd 'de' MMMM", { locale: ptBR });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">
            Agenda
          </h1>
          <p className="mt-1 capitalize text-[var(--ink-muted)]">{title}</p>
        </div>
        <Link href="/aulas/nova" className="btn-primary">
          Nova aula
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/agenda?dia=${prev}&view=${view}`}
          className="btn-secondary px-3 py-2 text-sm"
        >
          ←
        </Link>
        <Link
          href={`/agenda?dia=${format(new Date(), "yyyy-MM-dd")}&view=${view}`}
          className="btn-secondary px-3 py-2 text-sm"
        >
          Hoje
        </Link>
        <Link
          href={`/agenda?dia=${next}&view=${view}`}
          className="btn-secondary px-3 py-2 text-sm"
        >
          →
        </Link>
        <div className="ml-auto flex rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1">
          <Link
            href={`/agenda?dia=${dayKey}&view=dia`}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              view === "dia"
                ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                : "text-[var(--ink-muted)]"
            }`}
          >
            Dia
          </Link>
          <Link
            href={`/agenda?dia=${dayKey}&view=semana`}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              view === "semana"
                ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                : "text-[var(--ink-muted)]"
            }`}
          >
            Semana
          </Link>
        </div>
      </div>

      {!lessons?.length ? (
        <div className="panel p-8 text-center">
          <p className="font-medium">Nenhuma aula neste período</p>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">
            Agende uma aula a partir de um pacote ativo.
          </p>
          <Link href="/aulas/nova" className="btn-primary mt-4 inline-flex">
            Agendar aula
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {lessons.map((lesson) => {
            const pkg = lesson.lesson_packages as {
              title: string;
              total_lessons: number;
              students: { name: string } | null;
            } | null;
            const studentName = pkg?.students?.name ?? "Aluno";
            return (
              <li key={lesson.id}>
                <Link
                  href={`/aulas/${lesson.id}`}
                  className="panel block p-4 transition hover:border-[var(--accent)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium capitalize text-[var(--ink-muted)]">
                        {formatLessonDate(lesson.scheduled_at)}
                      </p>
                      <p className="mt-1 text-lg font-semibold">{studentName}</p>
                      <p className="text-sm text-[var(--ink-muted)]">
                        {pkg?.title}
                        {lesson.sequence_number
                          ? ` · Aula ${lesson.sequence_number}/${pkg?.total_lessons}`
                          : ""}
                      </p>
                    </div>
                    <span className={`badge badge-${lesson.status}`}>
                      {statusLabel(lesson.status)}
                    </span>
                  </div>
                  {lesson.status === "scheduled" && (
                    <p className="mt-3 text-sm font-medium text-[var(--accent)]">
                      Abrir para marcar OK ou remarcar →
                    </p>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
