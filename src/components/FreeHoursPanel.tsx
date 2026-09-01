import Link from "next/link";
import { WEEKDAY_LABELS } from "@/lib/assistente/occupancy";
import {
  formatMinutesLabel,
  lessonPlaceLabel,
  segmentDurationMinutes,
  travelLabel,
  weekFreeMinutes,
  type DayFreeHours,
  type TimelineKind,
  type TimelineSegment,
} from "@/lib/assistente/free-hours";

const KIND_BAR: Record<TimelineKind, string> = {
  free: "bg-[var(--accent)]",
  lesson: "bg-[var(--badge-info-fg)]",
  travel: "slot-travel-bar",
  outside: "bg-[var(--border)]",
};

function segmentClass(kind: TimelineKind) {
  if (kind === "free") return "slot-free";
  if (kind === "lesson") return "slot-lesson";
  if (kind === "travel") return "slot-travel";
  return "slot-outside";
}

function segmentTitle(segment: TimelineSegment) {
  if (segment.kind === "free") return "Livre";
  if (segment.kind === "outside") return "Fora do atendimento";
  if (segment.kind === "travel") return travelLabel(segment);
  return segment.studentName ?? "Aula";
}

function segmentDetail(segment: TimelineSegment) {
  if (segment.kind === "free") {
    return `${formatMinutesLabel(segmentDurationMinutes(segment))} para encaixar aula`;
  }
  if (segment.kind === "outside") {
    return "Intervalo fora do horário cadastrado no perfil";
  }
  if (segment.kind === "travel") {
    return "1h de locomoção (casa do aluno)";
  }
  const place = lessonPlaceLabel(segment.location);
  const pkg = segment.packageTitle;
  return [pkg, place].filter(Boolean).join(" · ");
}

function DayBar({ segments }: { segments: TimelineSegment[] }) {
  return (
    <div
      className="flex h-2.5 overflow-hidden rounded-full bg-[var(--border)]"
      aria-hidden
    >
      {segments.map((segment, index) => {
        const minutes = Math.max(segmentDurationMinutes(segment), 1);
        return (
          <span
            key={`${segment.start}-${segment.kind}-${index}`}
            title={`${segment.start}–${segment.end} ${segmentTitle(segment)}`}
            className={KIND_BAR[segment.kind]}
            style={{ flexGrow: minutes, flexBasis: 0 }}
          />
        );
      })}
    </div>
  );
}

function SegmentRow({ segment }: { segment: TimelineSegment }) {
  const title = segmentTitle(segment);
  const body = (
    <>
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
        {segment.start}–{segment.end}
      </p>
      <p className="mt-0.5 font-semibold">{title}</p>
      <p className="text-sm text-[var(--ink-muted)]">{segmentDetail(segment)}</p>
    </>
  );

  if (segment.kind === "lesson" && segment.lessonId) {
    return (
      <li>
        <Link
          href={`/aulas/${segment.lessonId}`}
          className={`block rounded-xl px-3 py-2.5 transition hover:opacity-90 ${segmentClass(segment.kind)}`}
        >
          {body}
        </Link>
      </li>
    );
  }

  return (
    <li className={`rounded-xl px-3 py-2.5 ${segmentClass(segment.kind)}`}>
      {body}
    </li>
  );
}

function DayCard({ day }: { day: DayFreeHours }) {
  const windowLabel =
    day.windows.length === 0
      ? "Sem horário de atendimento neste dia"
      : day.windows.map((window) => `${window.start}–${window.end}`).join(" · ");

  return (
    <article className="panel space-y-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">{WEEKDAY_LABELS[day.weekday]}</h3>
          <p className="text-sm text-[var(--ink-muted)]">{windowLabel}</p>
        </div>
        <p className="shrink-0 text-sm font-semibold text-[var(--accent)]">
          {formatMinutesLabel(day.freeMinutes)} livres
        </p>
      </div>
      <DayBar segments={day.segments} />
      <ul className="space-y-2">
        {day.segments.map((segment, index) => (
          <SegmentRow
            key={`${day.weekday}-${segment.start}-${segment.kind}-${index}`}
            segment={segment}
          />
        ))}
      </ul>
    </article>
  );
}

export function FreeHoursPanel({
  days,
  windowsSummary,
  windowsSaved,
}: {
  days: DayFreeHours[];
  windowsSummary: string;
  windowsSaved: boolean;
}) {
  const freeTotal = weekFreeMinutes(days);
  const travelDays = days.filter((day) =>
    day.segments.some((segment) => segment.kind === "travel"),
  ).length;

  return (
    <div className="space-y-4">
      <div className="panel space-y-3 p-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-[var(--ink-muted)]">Livre nesta semana</p>
            <p className="text-2xl font-semibold">{formatMinutesLabel(freeTotal)}</p>
          </div>
          <p className="text-sm text-[var(--ink-muted)]">
            {travelDays
              ? `${travelDays} dia${travelDays === 1 ? "" : "s"} com locomoção`
              : "Nenhuma locomoção nesta semana"}
          </p>
        </div>
        <p className="text-sm text-[var(--ink-muted)]">
          Cruza aulas agendadas com o horário do perfil. Na casa do aluno, 1h
          antes e 1h depois entram como deslocamento — não estão livres.
        </p>
        <p className="text-sm">
          <span className="font-medium">Atendimento:</span> {windowsSummary}
          {windowsSaved ? "" : " (padrão, ainda não salvo)"}{" "}
          <Link
            href="/perfil"
            className="font-medium text-[var(--accent)] hover:underline"
          >
            Editar no perfil
          </Link>
        </p>
        <ul className="flex flex-wrap gap-2 text-xs font-medium">
          <li className="slot-free rounded-full px-2.5 py-1">Livre</li>
          <li className="slot-lesson rounded-full px-2.5 py-1">Aula</li>
          <li className="slot-travel rounded-full px-2.5 py-1">
            Locomoção (casa do aluno)
          </li>
          <li className="slot-outside rounded-full px-2.5 py-1">
            Fora do atendimento
          </li>
        </ul>
      </div>

      {days.length === 0 ? (
        <div className="panel p-8 text-center">
          <p className="font-medium">Nenhum horário de atendimento nesta semana</p>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">
            Cadastre os dias em que você trabalha no perfil para ver as janelas
            livres.
          </p>
          <Link href="/perfil" className="btn-primary mt-4 inline-flex">
            Ir ao perfil
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {days.map((day) => (
            <DayCard key={day.weekday} day={day} />
          ))}
        </div>
      )}
    </div>
  );
}
