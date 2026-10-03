"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  LESSON_DURATION_MINUTES,
  WEEKDAY_LABELS,
  WEEKDAY_SHORT,
  minutesToTime,
  parseTimeToMinutes,
  withDayTravel,
  type OccupiedBlock,
  type TeacherWindow,
  type Weekday,
} from "@/lib/assistente/occupancy";
import {
  buildWeekFreeHours,
  formatMinutesLabel,
  segmentDurationMinutes,
  travelLabel,
  weekFreeMinutes,
  type TimelineSegment,
} from "@/lib/assistente/free-hours";
import type { Place } from "@/lib/geo/travel";
import {
  canPlace,
  firstFreeSlot,
  moveBlock,
  reservationChanges,
  snapMinutes,
} from "@/lib/students/ideal-grid";
import { saveReservedGrid } from "@/lib/students/actions";
import { reservedBlock, type GridStudent } from "@/lib/students/reserved";
import { DayCard } from "@/components/FreeHoursPanel";

const PX_PER_MINUTE = 1;
const DRAG_THRESHOLD_PX = 4;

type Range = { first: number; last: number };

type DragState = {
  lessonId: string;
  weekday: Weekday;
  start: number;
  valid: boolean;
  offsetMinutes: number;
  originX: number;
  originY: number;
  moved: boolean;
  overGrid: boolean;
  range: Range;
  /** Aluno vindo da lista "fora da grade" (ainda sem card). */
  student?: GridStudent;
};

function minutesOf(time: string) {
  return parseTimeToMinutes(time) ?? (time === "24:00" ? 24 * 60 : 0);
}

function backgroundClass(segment: TimelineSegment) {
  if (segment.kind === "free") return "slot-free";
  if (segment.kind === "travel") return "slot-travel";
  return "slot-outside";
}

function blockHref(block: OccupiedBlock) {
  if (block.source === "reserva") {
    return block.studentId ? `/alunos/${block.studentId}` : null;
  }
  return `/aulas/${block.lessonId}`;
}

function blockOrigin(block: OccupiedBlock) {
  if (block.source === "reserva") {
    return block.noActivePackage ? "Reserva sem pacote ativo" : null;
  }
  return block.projected ? "Sem reserva · semana passada" : "Sem reserva · pelas aulas";
}

function BackgroundSegment({ segment, range }: { segment: TimelineSegment; range: Range }) {
  const minutes = segmentDurationMinutes(segment);
  const height = Math.max(minutes * PX_PER_MINUTE, 2);
  const title =
    segment.kind === "travel"
      ? `${segment.start}–${segment.end} ${travelLabel(segment)}`
      : segment.kind === "free"
        ? `${segment.start}–${segment.end} Livre`
        : `${segment.start}–${segment.end} Fora do atendimento`;
  return (
    <div
      title={title}
      className={`pointer-events-none absolute inset-x-1 overflow-hidden rounded-md px-1.5 py-0.5 text-[11px] leading-tight ${backgroundClass(segment)}`}
      style={{ top: (minutesOf(segment.start) - range.first) * PX_PER_MINUTE, height }}
    >
      {segment.kind === "free" && height >= 28 ? (
        <span className="block truncate">Livre {formatMinutesLabel(minutes)}</span>
      ) : segment.kind === "travel" && height >= 16 ? (
        <span className="block truncate">{minutes} min</span>
      ) : null}
    </div>
  );
}

export function IdealWeekPanel({
  initialBlocks,
  outsideStudents,
  teacherWindows,
  base,
  windowsSummary,
  windowsSaved,
}: {
  initialBlocks: OccupiedBlock[];
  outsideStudents: GridStudent[];
  teacherWindows: TeacherWindow[];
  base: Place;
  windowsSummary: string;
  windowsSaved: boolean;
}) {
  const router = useRouter();
  const [original, setOriginal] = useState(initialBlocks);
  const [blocks, setBlocks] = useState(initialBlocks);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const columns = useRef(new Map<Weekday, HTMLDivElement>());
  const addedCount = useRef(0);

  if (initialBlocks !== original) {
    setOriginal(initialBlocks);
    setBlocks(initialBlocks);
  }

  const days = useMemo(
    () =>
      buildWeekFreeHours({
        teacherWindows,
        occupied: withDayTravel(blocks, base),
      }),
    [blocks, teacherWindows, base],
  );
  const changes = useMemo(() => reservationChanges(original, blocks), [original, blocks]);

  useEffect(() => {
    if (changes.length === 0) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [changes.length]);

  const liveRange = useMemo<Range | null>(() => {
    const all = days.flatMap((day) => day.segments);
    if (all.length === 0) return null;
    return {
      first: Math.floor(Math.min(...all.map((s) => minutesOf(s.start))) / 60) * 60,
      last: Math.ceil(Math.max(...all.map((s) => minutesOf(s.end))) / 60) * 60,
    };
  }, [days]);
  const range = drag?.range ?? liveRange;

  const lessons = blocks.length;
  const travelMinutes = days
    .flatMap((day) => day.segments)
    .filter((segment) => segment.kind === "travel")
    .reduce((sum, segment) => sum + segmentDurationMinutes(segment), 0);
  const withoutReserve = new Set(
    blocks.filter((block) => block.source !== "reserva").map((b) => b.studentId ?? b.lessonId),
  ).size;
  const inactive = new Set(
    blocks.filter((block) => block.noActivePackage).map((block) => block.studentId),
  ).size;
  const pool = outsideStudents.filter(
    (student) => !blocks.some((block) => block.studentId === student.id),
  );
  const addedIds = new Set(
    blocks
      .filter((block) => !original.some((item) => item.lessonId === block.lessonId))
      .map((block) => block.lessonId),
  );
  const movedIds = new Set(
    blocks
      .filter((block) => {
        const before = original.find((item) => item.lessonId === block.lessonId);
        return before && (before.weekday !== block.weekday || before.start !== block.start);
      })
      .map((block) => block.lessonId),
  );

  const dragRef = useRef<DragState | null>(null);
  const blocksRef = useRef(blocks);
  useEffect(() => {
    blocksRef.current = blocks;
  }, [blocks]);

  function updateDrag(next: DragState | null) {
    dragRef.current = next;
    setDrag(next);
  }

  const detachRef = useRef<(() => void) | null>(null);
  useEffect(() => () => detachRef.current?.(), []);

  function columnAt(clientX: number): { weekday: Weekday; top: number } | null {
    for (const [weekday, element] of columns.current) {
      const rect = element.getBoundingClientRect();
      if (clientX >= rect.left && clientX <= rect.right) return { weekday, top: rect.top };
    }
    return null;
  }

  function track(event: PointerEvent): DragState | null {
    const current = dragRef.current;
    if (!current) return null;
    const moved =
      current.moved ||
      Math.abs(event.clientX - current.originX) > DRAG_THRESHOLD_PX ||
      Math.abs(event.clientY - current.originY) > DRAG_THRESHOLD_PX;
    if (!moved) return current;
    const column = columnAt(event.clientX);
    if (current.student && !column) {
      return { ...current, moved: true, overGrid: false, valid: false };
    }
    const weekday = column?.weekday ?? current.weekday;
    const top =
      column?.top ?? columns.current.get(current.weekday)?.getBoundingClientRect().top ?? 0;
    const start = snapMinutes(
      current.range.first + (event.clientY - top) / PX_PER_MINUTE - current.offsetMinutes,
    );
    return {
      ...current,
      moved: true,
      overGrid: column != null,
      weekday,
      start,
      valid: canPlace(blocksRef.current, current.lessonId, weekday, start),
    };
  }

  function addStudent(student: GridStudent, weekday: Weekday, start: number) {
    addedCount.current += 1;
    const block = reservedBlock(student, { weekday, time: minutesToTime(start) }, base);
    const added = { ...block, lessonId: `${block.lessonId}:novo-${addedCount.current}` };
    setBlocks((items) => [...items, added]);
  }

  function drop(current: DragState) {
    if (current.student) {
      if (!current.moved) {
        const slot = firstFreeSlot(blocksRef.current, teacherWindows);
        if (!slot) {
          setNotice("Não achei horário livre no atendimento — arraste o aluno para a grade.");
          return;
        }
        addStudent(current.student, slot.weekday, minutesOf(slot.time));
        return;
      }
      if (!current.overGrid) return;
      if (!current.valid) {
        setNotice("Esse horário bate com outra aula do dia — escolha outro.");
        return;
      }
      addStudent(current.student, current.weekday, current.start);
      return;
    }
    if (!current.moved) {
      const block = blocksRef.current.find((item) => item.lessonId === current.lessonId);
      const href = block ? blockHref(block) : null;
      if (href) router.push(href);
      return;
    }
    if (!current.valid) {
      setNotice("Esse horário bate com outra aula do dia — o card voltou para o lugar.");
      return;
    }
    setBlocks((items) => moveBlock(items, current.lessonId, current.weekday, current.start));
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>, block: OccupiedBlock) {
    const rect = event.currentTarget.getBoundingClientRect();
    startDrag(event, {
      lessonId: block.lessonId,
      weekday: block.weekday,
      start: minutesOf(block.start),
      offsetMinutes: (event.clientY - rect.top) / PX_PER_MINUTE,
    });
  }

  function onStudentPointerDown(event: ReactPointerEvent<HTMLElement>, student: GridStudent) {
    startDrag(event, {
      lessonId: `reserva:${student.id}:arrastando`,
      weekday: 1,
      start: 0,
      offsetMinutes: LESSON_DURATION_MINUTES / 4,
      student,
    });
  }

  function startDrag(
    event: ReactPointerEvent<HTMLElement>,
    initial: Pick<DragState, "lessonId" | "weekday" | "start" | "offsetMinutes" | "student">,
  ) {
    if (!range || event.button !== 0) return;
    event.preventDefault();
    detachRef.current?.();
    setNotice(null);
    updateDrag({
      ...initial,
      valid: !initial.student,
      originX: event.clientX,
      originY: event.clientY,
      moved: false,
      overGrid: !initial.student,
      range,
    });

    const onMove = (moveEvent: PointerEvent) => {
      const next = track(moveEvent);
      if (next && next !== dragRef.current) updateDrag(next);
    };
    const onUp = (upEvent: PointerEvent) => {
      const current = track(upEvent);
      detach();
      if (current) drop(current);
    };
    const detach = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", detach);
      detachRef.current = null;
      updateDrag(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", detach);
    detachRef.current = detach;
  }

  function save() {
    if (changes.length === 0) return;
    const names = changes.map((change) => change.name).join(", ");
    if (
      !confirm(
        `Salvar como horário reservado de: ${names}? As aulas já agendadas não mudam — só a reserva (agenda ideal) desses alunos.`,
      )
    ) {
      return;
    }
    setError(null);
    startSaving(async () => {
      const result = await saveReservedGrid(
        changes.map((change) => ({ studentId: change.studentId, slots: change.slots })),
      );
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setNotice(
        `Reserva atualizada para ${result.saved} aluno${result.saved === 1 ? "" : "s"}.`,
      );
      router.refresh();
    });
  }

  const hours: number[] = [];
  if (range) for (let minute = range.first; minute <= range.last; minute += 60) hours.push(minute);
  const height = range ? (range.last - range.first) * PX_PER_MINUTE : 0;

  return (
    <div className="space-y-4">
      <div className="panel space-y-3 p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <p className="text-sm text-[var(--ink-muted)]">Aulas por semana</p>
            <p className="text-2xl font-semibold">{lessons}</p>
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
          <span className="hidden md:inline">
            Arraste os cards para simular outra grade; clique para abrir o aluno.
          </span>{" "}
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

      {changes.length > 0 || notice || error ? (
        <div className="panel sticky top-2 z-20 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm">
            {changes.length > 0 ? (
              <>
                <p className="font-medium">
                  {changes.length} aluno{changes.length === 1 ? "" : "s"} com horário
                  alterado (não salvo)
                </p>
                <p className="text-[var(--ink-muted)]">
                  {changes
                    .map(
                      (change) =>
                        `${change.name}: ${change.slots
                          .map((slot) => `${WEEKDAY_SHORT[slot.weekday]} ${slot.time}`)
                          .join(" · ")}`,
                    )
                    .join(" — ")}
                </p>
              </>
            ) : null}
            {notice ? <p className="text-[var(--ink-muted)]">{notice}</p> : null}
            {error ? <p className="form-error">{error}</p> : null}
          </div>
          {changes.length > 0 ? (
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                className="btn-secondary"
                disabled={saving}
                onClick={() => {
                  setBlocks(original);
                  setNotice(null);
                  setError(null);
                }}
              >
                Desfazer
              </button>
              <button type="button" className="btn-primary" disabled={saving} onClick={save}>
                {saving ? "Salvando..." : "Salvar reservas"}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {days.length === 0 || !range ? (
        <div className="panel p-8 text-center">
          <p className="font-medium">Nada para mostrar</p>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">
            Cadastre seu horário de atendimento no perfil e reserve horários nos
            alunos.
          </p>
        </div>
      ) : (
        <>
          {pool.length > 0 ? (
            <div className="panel hidden space-y-2 p-4 md:block">
              <p className="text-sm">
                <span className="font-medium">Alunos fora da grade</span>{" "}
                <span className="text-[var(--ink-muted)]">
                  — sem horário reservado nem aulas na semana. Arraste para um
                  horário ou clique para encaixar no primeiro horário livre.
                </span>
              </p>
              <ul className="flex flex-wrap gap-2">
                {pool.map((student) => (
                  <li key={student.id}>
                    <button
                      type="button"
                      title={`${student.name} — arraste para a grade ou clique para encaixar`}
                      onPointerDown={(event) => onStudentPointerDown(event, student)}
                      className={`slot-lesson cursor-grab touch-none rounded-full border border-dashed border-[var(--warning)] px-3 py-1 text-xs font-medium active:cursor-grabbing ${
                        drag?.student?.id === student.id ? "opacity-50" : ""
                      }`}
                    >
                      {student.name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="panel hidden overflow-x-auto p-4 md:block">
            <div
              className="grid gap-1 select-none"
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
                    style={{ top: (minute - range.first) * PX_PER_MINUTE }}
                  >
                    {String(minute / 60).padStart(2, "0")}h
                  </span>
                ))}
              </div>
              {days.map((day) => (
                <div
                  key={day.weekday}
                  ref={(element) => {
                    if (element) columns.current.set(day.weekday, element);
                    else columns.current.delete(day.weekday);
                  }}
                  className={`relative rounded-lg bg-[var(--bg)] ${
                    drag?.moved && drag.overGrid && drag.weekday === day.weekday
                      ? "ring-1 ring-[var(--accent)]"
                      : ""
                  }`}
                  style={{ height }}
                >
                  {hours.map((minute) => (
                    <span
                      key={minute}
                      className="pointer-events-none absolute inset-x-0 border-t border-[var(--border)]/60"
                      style={{ top: (minute - range.first) * PX_PER_MINUTE }}
                    />
                  ))}
                  {day.segments
                    .filter((segment) => segment.kind !== "lesson")
                    .map((segment, index) => (
                      <BackgroundSegment
                        key={`${segment.start}-${segment.kind}-${index}`}
                        segment={segment}
                        range={range}
                      />
                    ))}
                  {blocks
                    .filter((block) =>
                      (drag?.moved && drag.lessonId === block.lessonId
                        ? drag.weekday
                        : block.weekday) === day.weekday,
                    )
                    .map((block) => (
                      <LessonCard
                        key={block.lessonId}
                        block={block}
                        drag={drag}
                        moved={movedIds.has(block.lessonId)}
                        added={addedIds.has(block.lessonId)}
                        range={range}
                        onPointerDown={onPointerDown}
                        onRemove={() =>
                          setBlocks((items) =>
                            items.filter((item) => item.lessonId !== block.lessonId),
                          )
                        }
                      />
                    ))}
                  {drag?.student && drag.moved && drag.overGrid && drag.weekday === day.weekday ? (
                    <LessonCard
                      block={{
                        ...reservedBlock(
                          drag.student,
                          { weekday: drag.weekday, time: minutesToTime(drag.start) },
                          base,
                        ),
                        lessonId: drag.lessonId,
                      }}
                      drag={drag}
                      moved={false}
                      added
                      range={range}
                      onPointerDown={() => {}}
                    />
                  ) : null}
                </div>
              ))}
            </div>
          </div>
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

function LessonCard({
  block,
  drag,
  moved,
  added,
  range,
  onPointerDown,
  onRemove,
}: {
  block: OccupiedBlock;
  drag: DragState | null;
  moved: boolean;
  added: boolean;
  range: Range;
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>, block: OccupiedBlock) => void;
  onRemove?: () => void;
}) {
  const dragging = drag?.lessonId === block.lessonId && drag.moved;
  const weekday = dragging ? drag.weekday : block.weekday;
  const start = dragging ? drag.start : minutesOf(block.start);
  const origin = blockOrigin(block);
  const warn = block.source !== "reserva" || block.noActivePackage;
  return (
    <div
      role="button"
      tabIndex={0}
      title={`${WEEKDAY_SHORT[weekday]} ${minutesToTime(start)} ${block.studentName}${origin ? ` · ${origin}` : ""} — arraste para mover, clique para abrir`}
      onPointerDown={(event) => onPointerDown(event, block)}
      className={`slot-lesson absolute inset-x-1 z-10 cursor-grab touch-none overflow-hidden rounded-md px-1.5 py-0.5 text-[11px] leading-tight active:cursor-grabbing ${
        warn ? "border border-dashed border-[var(--warning)]" : ""
      } ${(moved || added) && !dragging ? "ring-2 ring-[var(--accent)]" : ""} ${
        dragging ? (drag.valid ? "z-20 opacity-90 shadow-lg" : "z-20 opacity-90 ring-2 ring-red-500") : ""
      }`}
      style={{
        top: (start - range.first) * PX_PER_MINUTE,
        height: LESSON_DURATION_MINUTES * PX_PER_MINUTE,
      }}
    >
      {added && onRemove && !dragging ? (
        <button
          type="button"
          aria-label={`Tirar ${block.studentName} da grade`}
          title="Tirar da grade"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={onRemove}
          className="absolute top-0.5 right-1 rounded px-1 leading-none opacity-70 hover:opacity-100"
        >
          ×
        </button>
      ) : null}
      <span className="block truncate pr-3 font-semibold">{block.studentName}</span>
      <span className="block truncate opacity-80">
        {minutesToTime(start)}
        {added && !dragging ? " · novo" : moved && !dragging ? " · movido" : ""}
      </span>
    </div>
  );
}
