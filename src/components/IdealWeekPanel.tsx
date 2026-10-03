import Link from "next/link";
import { WEEKDAY_LABELS, parseTimeToMinutes } from "@/lib/assistente/occupancy";
import {
  formatMinutesLabel,
  segmentDurationMinutes,
  segmentHref,
  segmentOriginLabel,
  travelLabel,
  weekFreeMinutes,
  type DayFreeHours,
  type TimelineSegment,
} from "@/lib/assistente/free-hours";
import { DayCard } from "@/components/FreeHoursPanel";

const PX_PER_MINUTE = 1;

function segmentClass(segment: TimelineSegment) {
  if (segment.kind === "free") return "slot-free";
  if (segment.kind === "travel") return "slot-travel";
  if (segment.kind === "outside") return "slot-outside";
  return segment.source === "reserva" && !segment.noActivePackage
    ? "slot-lesson"
    : "slot-lesson border border-dashed border-[var(--warning)]";
}

function minutesOf(time: string) {
  return parseTimeToMinutes(time) ?? (time === "24:00" ? 24 * 60 : 0);
}

function GridSegment({
  segment,
  top,
}: {
  segment: TimelineSegment;
  top: number;
}) {
  const minutes = segmentDurationMinutes(segment);
  const height = Math.max(minutes * PX_PER_MINUTE, 2);
  const href = segmentHref(segment);
  const origin = segmentOriginLabel(segment);
  const title =
    segment.kind === "lesson"
      ? `${segment.start}–${segment.end} ${segment.studentName ?? "Aula"}${origin ? ` · ${origin}` : ""}`
      : segment.kind === "travel"
        ? `${segment.start}–${segment.end} ${travelLabel(segment)}`
        : segment.kind === "free"
          ? `${segment.start}–${segment.end} Livre`
          : `${segment.start}–${segment.end} Fora do atendimento`;

  const content =
    segment.kind === "lesson" ? (
      <>
        <span className="block truncate font-semibold">{segment.studentName}</span>
        {height >= 36 ? (
          <span className="block truncate opacity-80">{segment.start}</span>
        ) : null}
      </>
    ) : segment.kind === "free" && height >= 28 ? (
      <span className="block truncate">Livre {formatMinutesLabel(minutes)}</span>
    ) : segment.kind === "travel" && height >= 16 ? (
      <span className="block truncate">{minutes} min</span>
    ) : null;

  const className = `absolute inset-x-1 overflow-hidden rounded-md px-1.5 py-0.5 text-[11px] leading-tight ${segmentClass(segment)}`;
  const style = { top, height };
  return href ? (
    <Link href={href} title={title} className={`${className} hover:opacity-90`} style={style}>
      {content}
    </Link>
  ) : (
    <div title={title} className={className} style={style}>
      {content}
    </div>
  );
}

function WeekGrid({ days }: { days: DayFreeHours[] }) {
  const all = days.flatMap((day) => day.segments);
  if (all.length === 0) return null;
  const first = Math.floor(Math.min(...all.map((s) => minutesOf(s.start))) / 60) * 60;
  const last = Math.ceil(Math.max(...all.map((s) => minutesOf(s.end))) / 60) * 60;
  const height = (last - first) * PX_PER_MINUTE;
  const hours: number[] = [];
  for (let minute = first; minute <= last; minute += 60) hours.push(minute);

  return (
    <div className="panel hidden overflow-x-auto p-4 md:block">
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: `3rem repeat(${days.length}, minmax(7rem, 1fr))` }}
      >
        <div />
        {days.map((day) => (
          <div key={day.weekday} className="pb-1 text-center text-sm font-semibold">
            {WEEKDAY_LABELS[day.weekday]}
            <span className="block text-xs font-normal text-[var(--ink-muted)]">
              {formatMinutesLabel(day.freeMinutes)} livres
            </span>
          </div>
        ))}
        <div className="relative" style={{ height }}>
          {hours.map((minute) => (
            <span
              key={minute}
              className="absolute right-1 -translate-y-1/2 text-[11px] text-[var(--ink-muted)]"
              style={{ top: (minute - first) * PX_PER_MINUTE }}
            >
              {String(minute / 60).padStart(2, "0")}h
            </span>
          ))}
        </div>
        {days.map((day) => (
          <div
            key={day.weekday}
            className="relative rounded-lg bg-[var(--bg)]"
            style={{ height }}
          >
            {hours.map((minute) => (
              <span
                key={minute}
                className="absolute inset-x-0 border-t border-[var(--border)]/60"
                style={{ top: (minute - first) * PX_PER_MINUTE }}
              />
            ))}
            {day.segments.map((segment, index) => (
              <GridSegment
                key={`${segment.start}-${segment.kind}-${index}`}
                segment={segment}
                top={(minutesOf(segment.start) - first) * PX_PER_MINUTE}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function IdealWeekPanel({
  days,
  windowsSummary,
  windowsSaved,
}: {
  days: DayFreeHours[];
  windowsSummary: string;
  windowsSaved: boolean;
}) {
  const segments = days.flatMap((day) => day.segments);
  const lessons = segments.filter((segment) => segment.kind === "lesson");
  const travelMinutes = segments
    .filter((segment) => segment.kind === "travel")
    .reduce((sum, segment) => sum + segmentDurationMinutes(segment), 0);
  const withoutReserve = new Set(
    lessons
      .filter((segment) => segment.source !== "reserva")
      .map((segment) => segment.studentId ?? segment.lessonId),
  ).size;
  const inactive = new Set(
    lessons
      .filter((segment) => segment.noActivePackage)
      .map((segment) => segment.studentId),
  ).size;

  return (
    <div className="space-y-4">
      <div className="panel space-y-3 p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <p className="text-sm text-[var(--ink-muted)]">Aulas por semana</p>
            <p className="text-2xl font-semibold">{lessons.length}</p>
          </div>
          <div>
            <p className="text-sm text-[var(--ink-muted)]">Livre</p>
            <p className="text-2xl font-semibold">{formatMinutesLabel(weekFreeMinutes(days))}</p>
          </div>
          <div>
            <p className="text-sm text-[var(--ink-muted)]">Deslocamento</p>
            <p className="text-2xl font-semibold">{formatMinutesLabel(travelMinutes)}</p>
          </div>
          <div>
            <p className="text-sm text-[var(--ink-muted)]">Sem reserva</p>
            <p className="text-2xl font-semibold">
              {withoutReserve} aluno{withoutReserve === 1 ? "" : "s"}
            </p>
          </div>
        </div>
        <p className="text-sm text-[var(--ink-muted)]">
          Semana-modelo pelo horário reservado de cada aluno, sem remarcações
          ou reposições. Quem ainda não tem reserva aparece pelas aulas
          (próximos 7 dias ou, sem aulas futuras, a semana anterior), com borda
          tracejada.
          {inactive
            ? ` ${inactive} reserva${inactive === 1 ? "" : "s"} sem pacote ativo.`
            : ""}{" "}
          <Link href="/alunos" className="font-medium text-[var(--accent)] hover:underline">
            Editar reservas nos alunos
          </Link>
        </p>
        <p className="text-sm">
          <span className="font-medium">Atendimento:</span> {windowsSummary}
          {windowsSaved ? "" : " (padrão, ainda não salvo)"}{" "}
          <Link href="/perfil" className="font-medium text-[var(--accent)] hover:underline">
            Editar no perfil
          </Link>
        </p>
        <ul className="flex flex-wrap gap-2 text-xs font-medium">
          <li className="slot-lesson rounded-full px-2.5 py-1">Reservado</li>
          <li className="slot-lesson rounded-full border border-dashed border-[var(--warning)] px-2.5 py-1">
            Sem reserva / sem pacote
          </li>
          <li className="slot-travel rounded-full px-2.5 py-1">Deslocamento</li>
          <li className="slot-free rounded-full px-2.5 py-1">Livre</li>
          <li className="slot-outside rounded-full px-2.5 py-1">Fora do atendimento</li>
        </ul>
      </div>

      {days.length === 0 ? (
        <div className="panel p-8 text-center">
          <p className="font-medium">Nada para mostrar</p>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">
            Cadastre seu horário de atendimento no perfil e reserve horários nos
            alunos.
          </p>
        </div>
      ) : (
        <>
          <WeekGrid days={days} />
          <div className="space-y-3 md:hidden">
            {days.map((day) => (
              <DayCard key={day.weekday} day={day} showOrigin />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
