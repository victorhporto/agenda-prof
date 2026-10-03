import { addDays, format, getISODay } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { APP_TIMEZONE, formatInSaoPaulo } from "@/lib/timezone";
import {
  LESSON_DURATION_MINUTES,
  buildOccupiedBlocks,
  isWeekday,
  minutesToTime,
  parseTimeToMinutes,
  placeForLocation,
  selectGridLessons,
  withDayTravel,
  type OccupiedBlock,
  type ScheduledLessonRow,
  type StudentSlot,
  type Weekday,
} from "@/lib/assistente/occupancy";
import { parseStoredLocation } from "@/lib/lessons/location";
import { basePlace, studentPlace, type Place } from "@/lib/geo/travel";

const MAX_RESERVED_SLOTS = 14;

export const RESERVED_PACKAGE_TITLE = "Horário reservado";

function sortSlots(slots: StudentSlot[]): StudentSlot[] {
  return [...slots].sort(
    (a, b) => a.weekday - b.weekday || a.time.localeCompare(b.time),
  );
}

/** Lista vazia é válida: o aluno simplesmente não tem horário reservado. */
export function parseReservedSlots(
  raw: unknown,
): { ok: true; value: StudentSlot[] } | { ok: false; error: string } {
  if (raw == null || raw === "") return { ok: true, value: [] };
  let data = raw;
  if (typeof raw === "string") {
    try {
      data = JSON.parse(raw);
    } catch {
      return { ok: false, error: "Horário reservado inválido" };
    }
  }
  if (!Array.isArray(data)) {
    return { ok: false, error: "Horário reservado inválido" };
  }
  if (data.length > MAX_RESERVED_SLOTS) {
    return { ok: false, error: `No máximo ${MAX_RESERVED_SLOTS} horários reservados` };
  }

  const seen = new Set<string>();
  const slots: StudentSlot[] = [];
  for (const item of data) {
    if (!item || typeof item !== "object") {
      return { ok: false, error: "Horário reservado inválido" };
    }
    const row = item as Record<string, unknown>;
    const weekday = Number(row.weekday);
    const minutes =
      typeof row.time === "string" ? parseTimeToMinutes(row.time) : null;
    if (!isWeekday(weekday) || minutes == null) {
      return {
        ok: false,
        error: "Cada horário reservado precisa de dia e hora",
      };
    }
    const time = minutesToTime(minutes);
    const key = `${weekday}-${time}`;
    if (seen.has(key)) continue;
    seen.add(key);
    slots.push({ weekday, time });
  }

  const sorted = sortSlots(slots);
  for (let index = 1; index < sorted.length; index++) {
    const previous = sorted[index - 1]!;
    const current = sorted[index]!;
    if (
      previous.weekday === current.weekday &&
      parseTimeToMinutes(current.time)! - parseTimeToMinutes(previous.time)! <
        LESSON_DURATION_MINUTES
    ) {
      return {
        ok: false,
        error: "Dois horários reservados do aluno se sobrepõem no mesmo dia",
      };
    }
  }
  return { ok: true, value: sorted };
}

export function reservedSlotsFromStored(raw: unknown): StudentSlot[] {
  const parsed = parseReservedSlots(raw);
  return parsed.ok ? parsed.value : [];
}

export type ReservationOwner = {
  studentId: string;
  name: string;
  slots: StudentSlot[];
};

export type ReservationConflict = {
  slot: StudentSlot;
  names: string[];
};

/** Horários que batem (mesma hora de aula) com a reserva de outro aluno. */
export function findReservationConflicts(
  slots: StudentSlot[],
  others: ReservationOwner[],
  ignoreStudentId?: string,
): ReservationConflict[] {
  const conflicts: ReservationConflict[] = [];
  for (const slot of slots) {
    const start = parseTimeToMinutes(slot.time);
    if (start == null) continue;
    const names = new Set<string>();
    for (const other of others) {
      if (other.studentId === ignoreStudentId) continue;
      for (const theirs of other.slots) {
        if (theirs.weekday !== slot.weekday) continue;
        const theirStart = parseTimeToMinutes(theirs.time);
        if (theirStart == null) continue;
        if (Math.abs(theirStart - start) < LESSON_DURATION_MINUTES) {
          names.add(other.name);
        }
      }
    }
    if (names.size) conflicts.push({ slot, names: [...names] });
  }
  return conflicts;
}

type LessonForSuggestion = {
  scheduled_at: string;
  status: string;
  rescheduled_from_id?: string | null;
};

function slotOf(iso: string): StudentSlot | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const weekday = getISODay(toZonedTime(date, APP_TIMEZONE));
  const minutes = parseTimeToMinutes(formatInSaoPaulo(date, "HH:mm"));
  if (!isWeekday(weekday) || minutes == null) return null;
  return { weekday, time: minutesToTime(minutes) };
}

function uniqueSlots(isos: string[]): StudentSlot[] {
  const seen = new Set<string>();
  const slots: StudentSlot[] = [];
  for (const iso of isos) {
    const slot = slotOf(iso);
    if (!slot) continue;
    const key = `${slot.weekday}-${slot.time}`;
    if (seen.has(key)) continue;
    seen.add(key);
    slots.push(slot);
  }
  return sortSlots(slots);
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Sugere a reserva a partir das aulas: as dos próximos 7 dias; sem aulas
 * futuras, a última semana em que o aluno teve aula (horário original das
 * remarcadas, sem canceladas).
 */
export function suggestReservedSlots(
  lessons: LessonForSuggestion[],
  now = new Date(),
): StudentSlot[] {
  const nowMs = now.getTime();
  const upcoming = lessons.filter((lesson) => {
    const time = new Date(lesson.scheduled_at).getTime();
    return (
      time >= nowMs &&
      time < nowMs + WEEK_MS &&
      ["scheduled", "completed", "missed"].includes(lesson.status)
    );
  });
  if (upcoming.length) {
    return uniqueSlots(upcoming.map((lesson) => lesson.scheduled_at));
  }

  const past = lessons
    .filter(
      (lesson) =>
        new Date(lesson.scheduled_at).getTime() < nowMs &&
        ["scheduled", "completed", "missed", "rescheduled"].includes(lesson.status) &&
        !lesson.rescheduled_from_id,
    )
    .sort(
      (a, b) =>
        new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime(),
    );
  const latest = past[0];
  if (!latest) return [];
  const latestMs = new Date(latest.scheduled_at).getTime();
  return uniqueSlots(
    past
      .filter((lesson) => latestMs - new Date(lesson.scheduled_at).getTime() < WEEK_MS)
      .map((lesson) => lesson.scheduled_at),
  );
}

export type GridStudent = {
  id: string;
  name: string;
  default_location: string | null;
  lat: number | null;
  lng: number | null;
  reserved_slots: unknown;
  hasActivePackage: boolean;
};

function reservedBlocks(student: GridStudent, base: Place): OccupiedBlock[] {
  const location = parseStoredLocation(student.default_location);
  const coords =
    student.lat != null && student.lng != null
      ? { lat: student.lat, lng: student.lng }
      : null;
  const place = placeForLocation(location, base, studentPlace(student.id, coords));
  return reservedSlotsFromStored(student.reserved_slots).map((slot) => {
    const start = parseTimeToMinutes(slot.time)!;
    return {
      weekday: slot.weekday,
      start: slot.time,
      end: minutesToTime(start + LESSON_DURATION_MINUTES),
      occupiesStart: slot.time,
      occupiesEnd: minutesToTime(start + LESSON_DURATION_MINUTES),
      location,
      studentId: student.id,
      studentName: student.name,
      packageTitle: RESERVED_PACKAGE_TITLE,
      lessonId: `reserva:${student.id}:${slot.weekday}-${slot.time}`,
      scheduledAt: "",
      place,
      source: "reserva",
      ...(student.hasActivePackage ? {} : { noActivePackage: true }),
    } satisfies OccupiedBlock;
  });
}

/**
 * Grade ideal: o horário reservado de cada aluno. Quem ainda não tem reserva
 * entra pelas aulas (próximos 7 dias ou, sem aulas futuras, a semana anterior).
 */
export function buildIdealGrid(input: {
  students: GridStudent[];
  lessons: ScheduledLessonRow[];
  todayStart: Date;
  base?: Place;
}): OccupiedBlock[] {
  const base = input.base ?? basePlace();
  const reserved = new Set<string>();
  const blocks: OccupiedBlock[] = [];
  for (const student of input.students) {
    const own = reservedBlocks(student, base);
    if (own.length === 0) continue;
    reserved.add(student.id);
    blocks.push(...own);
  }

  const fromLessons = selectGridLessons(input.lessons, input.todayStart).filter(
    (row) => {
      const studentId = row.lesson_packages?.students?.id;
      return !studentId || !reserved.has(studentId);
    },
  );
  blocks.push(...buildOccupiedBlocks(fromLessons, base));
  return withDayTravel(blocks, base);
}

/**
 * Datas das próximas `count` aulas seguindo a reserva, a partir do primeiro
 * horário reservado depois de `after`.
 */
export function reservedLessonDates(
  slots: StudentSlot[],
  count: number,
  after: Date,
): string[] {
  if (slots.length === 0 || count <= 0) return [];
  const byWeekday = new Map<Weekday, string[]>();
  for (const slot of sortSlots(slots)) {
    const list = byWeekday.get(slot.weekday) ?? [];
    list.push(slot.time);
    byWeekday.set(slot.weekday, list);
  }

  const dates: string[] = [];
  let day = toZonedTime(after, APP_TIMEZONE);
  for (let guard = 0; guard < 800 && dates.length < count; guard++) {
    const weekday = getISODay(day) as Weekday;
    const ymd = format(day, "yyyy-MM-dd");
    for (const time of byWeekday.get(weekday) ?? []) {
      const at = fromZonedTime(`${ymd}T${time}:00`, APP_TIMEZONE);
      if (at.getTime() <= after.getTime()) continue;
      dates.push(at.toISOString());
      if (dates.length >= count) break;
    }
    day = addDays(day, 1);
  }
  return dates;
}
