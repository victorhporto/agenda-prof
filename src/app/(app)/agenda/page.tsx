import Link from "next/link";
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { createClient } from "@/lib/supabase/server";
import { formatLessonDate, statusLabel } from "@/lib/utils";
import {
  APP_TIMEZONE,
  formatInSaoPaulo,
  parseYmdInSaoPaulo,
  todayYmdSaoPaulo,
} from "@/lib/timezone";

type SearchParams = Promise<{
  dia?: string;
  view?: string;
  filtro?: string;
  q?: string;
}>;
type AgendaView = "dia" | "semana" | "mes";
type AgendaFilter = "todas" | "pendentes" | "atrasadas";

type LessonRow = {
  id: string;
  scheduled_at: string;
  status: string;
  sequence_number: number | null;
  lesson_packages: {
    title: string;
    total_lessons: number;
    students: { name: string } | null;
  } | null;
};

const WEEKDAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function resolveView(raw: string | undefined): AgendaView {
  if (raw === "semana" || raw === "mes") return raw;
  return "dia";
}

function resolveFilter(raw: string | undefined): AgendaFilter {
  if (raw === "pendentes" || raw === "atrasadas") return raw;
  return "todas";
}

function ymdBounds(ymd: string) {
  return {
    start: fromZonedTime(`${ymd}T00:00:00`, APP_TIMEZONE),
    end: fromZonedTime(`${ymd}T23:59:59.999`, APP_TIMEZONE),
  };
}

function agendaHref({
  dia,
  view,
  filtro,
  q,
}: {
  dia: string;
  view: AgendaView;
  filtro?: AgendaFilter;
  q?: string;
}) {
  const params = new URLSearchParams();
  params.set("dia", dia);
  params.set("view", view);
  if (filtro && filtro !== "todas") params.set("filtro", filtro);
  if (q?.trim()) params.set("q", q.trim());
  return `/agenda?${params.toString()}`;
}

function applyLessonFilters(
  lessons: LessonRow[],
  filtro: AgendaFilter,
  q: string,
  now: Date,
) {
  const query = q.trim().toLowerCase();
  return lessons.filter((lesson) => {
    if (filtro === "pendentes" && lesson.status !== "scheduled") return false;
    if (filtro === "atrasadas") {
      if (lesson.status !== "scheduled") return false;
      if (new Date(lesson.scheduled_at).getTime() >= now.getTime()) return false;
    }
    if (query) {
      const name = lesson.lesson_packages?.students?.name?.toLowerCase() ?? "";
      const title = lesson.lesson_packages?.title?.toLowerCase() ?? "";
      if (!name.includes(query) && !title.includes(query)) return false;
    }
    return true;
  });
}

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const view = resolveView(params.view);
  const filtro = resolveFilter(params.filtro);
  const q = params.q ?? "";
  const dayKey = params.dia?.slice(0, 10) || todayYmdSaoPaulo();
  const baseDate = parseYmdInSaoPaulo(dayKey);
  const zonedBase = toZonedTime(baseDate, APP_TIMEZONE);
  const now = new Date();

  let rangeStart: Date;
  let rangeEnd: Date;
  let prev: string;
  let next: string;
  let title: string;

  if (view === "mes") {
    const monthStart = startOfMonth(zonedBase);
    const monthEnd = endOfMonth(zonedBase);
    const monthStartYmd = format(monthStart, "yyyy-MM-dd");
    const monthEndYmd = format(monthEnd, "yyyy-MM-dd");
    rangeStart = ymdBounds(monthStartYmd).start;
    rangeEnd = ymdBounds(monthEndYmd).end;
    prev = format(addMonths(monthStart, -1), "yyyy-MM-dd");
    next = format(addMonths(monthStart, 1), "yyyy-MM-dd");
    title = formatInSaoPaulo(rangeStart, "MMMM yyyy");
  } else if (view === "semana") {
    const weekStart = startOfWeek(zonedBase, { weekStartsOn: 1 });
    const weekStartYmd = format(weekStart, "yyyy-MM-dd");
    const weekEndYmd = format(addDays(weekStart, 6), "yyyy-MM-dd");
    rangeStart = ymdBounds(weekStartYmd).start;
    rangeEnd = ymdBounds(weekEndYmd).end;
    prev = format(addDays(weekStart, -7), "yyyy-MM-dd");
    next = format(addDays(weekStart, 7), "yyyy-MM-dd");
    title = `Semana de ${format(weekStart, "dd/MM")}`;
  } else {
    const bounds = ymdBounds(dayKey);
    rangeStart = bounds.start;
    rangeEnd = bounds.end;
    prev = format(addDays(zonedBase, -1), "yyyy-MM-dd");
    next = format(addDays(zonedBase, 1), "yyyy-MM-dd");
    title = formatInSaoPaulo(rangeStart, "EEEE, dd 'de' MMMM");
  }

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

  const allLessons = (lessons ?? []) as unknown as LessonRow[];
  const lessonRows = applyLessonFilters(allLessons, filtro, q, now);
  const todayKey = todayYmdSaoPaulo();

  const monthCells =
    view === "mes"
      ? buildMonthCells(zonedBase, lessonRows, todayKey, filtro, q)
      : null;

  const filterTabs: { key: AgendaFilter; label: string }[] = [
    { key: "todas", label: "Todas" },
    { key: "pendentes", label: "Pendentes de OK" },
    { key: "atrasadas", label: "Atrasadas" },
  ];

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
          href={agendaHref({ dia: prev, view, filtro, q })}
          className="btn-secondary px-3 py-2 text-sm"
        >
          ←
        </Link>
        <Link
          href={agendaHref({ dia: todayKey, view, filtro, q })}
          className="btn-secondary px-3 py-2 text-sm"
        >
          Hoje
        </Link>
        <Link
          href={agendaHref({ dia: next, view, filtro, q })}
          className="btn-secondary px-3 py-2 text-sm"
        >
          →
        </Link>
        <div className="ml-auto flex rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1">
          {(
            [
              ["dia", "Dia"],
              ["semana", "Semana"],
              ["mes", "Mês"],
            ] as const
          ).map(([value, label]) => (
            <Link
              key={value}
              href={agendaHref({ dia: dayKey, view: value, filtro, q })}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                view === value
                  ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                  : "text-[var(--ink-muted)]"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {filterTabs.map((item) => (
            <Link
              key={item.key}
              href={agendaHref({
                dia: dayKey,
                view,
                filtro: item.key,
                q,
              })}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                filtro === item.key
                  ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                  : "border border-[var(--border)] bg-[var(--surface)] text-[var(--ink-muted)]"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>

        <form
          action="/agenda"
          method="get"
          className="flex flex-col gap-2 sm:flex-row"
        >
          <input type="hidden" name="dia" value={dayKey} />
          <input type="hidden" name="view" value={view} />
          {filtro !== "todas" ? (
            <input type="hidden" name="filtro" value={filtro} />
          ) : null}
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar por aluno ou pacote..."
            className="input"
          />
          <button type="submit" className="btn-secondary shrink-0">
            Buscar
          </button>
        </form>
      </div>

      {view === "mes" && monthCells ? (
        <MonthGrid cells={monthCells} filtro={filtro} q={q} />
      ) : !lessonRows.length ? (
        <div className="panel p-8 text-center">
          <p className="font-medium">
            {allLessons.length && (filtro !== "todas" || q.trim())
              ? "Nenhuma aula com este filtro"
              : "Nenhuma aula neste período"}
          </p>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">
            {allLessons.length && (filtro !== "todas" || q.trim())
              ? "Tente limpar a busca ou mudar o filtro."
              : "Agende uma aula a partir de um pacote ativo."}
          </p>
          {!(allLessons.length && (filtro !== "todas" || q.trim())) ? (
            <Link href="/aulas/nova" className="btn-primary mt-4 inline-flex">
              Agendar aula
            </Link>
          ) : (
            <Link
              href={agendaHref({ dia: dayKey, view })}
              className="btn-secondary mt-4 inline-flex"
            >
              Limpar filtros
            </Link>
          )}
        </div>
      ) : (
        <ul className="space-y-3">
          {lessonRows.map((lesson) => {
            const pkg = lesson.lesson_packages;
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

type MonthCell = {
  ymd: string;
  dayNumber: string;
  inMonth: boolean;
  isToday: boolean;
  lessons: LessonRow[];
};

function buildMonthCells(
  zonedBase: Date,
  lessons: LessonRow[],
  todayKey: string,
  _filtro: AgendaFilter,
  _q: string,
): MonthCell[] {
  const monthStart = startOfMonth(zonedBase);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(zonedBase), { weekStartsOn: 1 });
  const monthKey = format(monthStart, "yyyy-MM");

  const cells: MonthCell[] = [];
  for (
    let cursor = gridStart;
    cursor <= gridEnd;
    cursor = addDays(cursor, 1)
  ) {
    const ymd = format(cursor, "yyyy-MM-dd");
    const dayLessons = lessons.filter(
      (lesson) => formatInSaoPaulo(lesson.scheduled_at, "yyyy-MM-dd") === ymd,
    );
    cells.push({
      ymd,
      dayNumber: format(cursor, "d"),
      inMonth: ymd.startsWith(monthKey),
      isToday: ymd === todayKey,
      lessons: dayLessons,
    });
  }
  return cells;
}

function MonthGrid({
  cells,
  filtro,
  q,
}: {
  cells: MonthCell[];
  filtro: AgendaFilter;
  q: string;
}) {
  const totalInMonth = cells
    .filter((cell) => cell.inMonth)
    .reduce((sum, cell) => sum + cell.lessons.length, 0);

  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--ink-muted)]">
        {totalInMonth} aula{totalInMonth === 1 ? "" : "s"} neste mês
        {filtro !== "todas" || q.trim() ? " (filtradas)" : ""} · toque em um dia
        para ver o detalhe
      </p>

      <div className="panel overflow-hidden p-2 sm:p-3">
        <div className="mb-1 grid grid-cols-7 gap-1">
          {WEEKDAY_LABELS.map((label) => (
            <div
              key={label}
              className="px-1 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-muted)] sm:text-xs"
            >
              {label}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {cells.map((cell) => {
            const count = cell.lessons.length;
            const pending = cell.lessons.filter(
              (l) => l.status === "scheduled",
            ).length;

            return (
              <Link
                key={cell.ymd}
                href={agendaHref({
                  dia: cell.ymd,
                  view: "dia",
                  filtro,
                  q,
                })}
                className={`min-h-[4.5rem] rounded-xl border p-1.5 transition sm:min-h-[5.5rem] sm:p-2 ${
                  cell.inMonth
                    ? "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)]"
                    : "border-transparent bg-transparent opacity-40"
                } ${cell.isToday ? "ring-2 ring-[var(--accent)] ring-offset-1 ring-offset-[var(--bg)]" : ""}`}
              >
                <div className="flex items-start justify-between gap-1">
                  <span
                    className={`text-xs font-semibold sm:text-sm ${
                      cell.isToday
                        ? "text-[var(--accent)]"
                        : cell.inMonth
                          ? "text-[var(--ink)]"
                          : "text-[var(--ink-muted)]"
                    }`}
                  >
                    {cell.dayNumber}
                  </span>
                  {count > 0 ? (
                    <span className="rounded-full bg-[var(--accent-soft)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--accent)] sm:text-xs">
                      {count}
                    </span>
                  ) : null}
                </div>

                {count > 0 ? (
                  <>
                    <div className="mt-1.5 hidden space-y-1 sm:block">
                      {cell.lessons.slice(0, 2).map((lesson) => {
                        const name =
                          lesson.lesson_packages?.students?.name ?? "Aluno";
                        return (
                          <p
                            key={lesson.id}
                            className="truncate text-[11px] leading-tight text-[var(--ink-muted)]"
                          >
                            <span className="font-medium text-[var(--ink)]">
                              {formatInSaoPaulo(lesson.scheduled_at, "HH:mm")}
                            </span>{" "}
                            {name}
                          </p>
                        );
                      })}
                      {count > 2 ? (
                        <p className="text-[10px] text-[var(--ink-muted)]">
                          +{count - 2} mais
                        </p>
                      ) : null}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-0.5 sm:hidden">
                      {cell.lessons.slice(0, 3).map((lesson) => (
                        <span
                          key={lesson.id}
                          className={`h-1.5 w-1.5 rounded-full ${
                            lesson.status === "scheduled"
                              ? "bg-[var(--accent)]"
                              : lesson.status === "completed"
                                ? "bg-[var(--success)]"
                                : "bg-[var(--warning)]"
                          }`}
                        />
                      ))}
                    </div>
                    {pending > 0 ? (
                      <p className="mt-1 hidden text-[10px] font-medium text-[var(--accent)] sm:block">
                        {pending} pendente{pending === 1 ? "" : "s"}
                      </p>
                    ) : null}
                  </>
                ) : null}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
