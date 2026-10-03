import { addDays, format, getISODay, startOfWeek } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { APP_TIMEZONE, formatInSaoPaulo } from "@/lib/timezone";
import {
  LOCATION_SHORT,
  isLessonLocation,
  effectiveLocation,
  type LessonLocation,
} from "@/lib/lessons/location";
import {
  NO_TRAVEL,
  basePlace,
  checkInsertion,
  estimateTravel,
  isBase,
  studentPlace,
  type Place,
  type RouteStop,
  type TravelEstimate,
} from "@/lib/geo/travel";

export {
  LOCATION_LABELS,
  LOCATION_SHORT,
  LOCATIONS,
  isLessonLocation,
  parseStoredLocation,
  type LessonLocation,
} from "@/lib/lessons/location";

export const LESSON_DURATION_MINUTES = 60;
export const TRAVEL_BUFFER_MINUTES = 60;

export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  1: "Segunda",
  2: "Terça",
  3: "Quarta",
  4: "Quinta",
  5: "Sexta",
  6: "Sábado",
  7: "Domingo",
};

export const WEEKDAY_SHORT: Record<Weekday, string> = {
  1: "Seg",
  2: "Ter",
  3: "Qua",
  4: "Qui",
  5: "Sex",
  6: "Sáb",
  7: "Dom",
};

export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;

export type StudentSlot = {
  weekday: Weekday;
  time: string;
};

export type TeacherWindow = {
  weekday: Weekday;
  start: string;
  end: string;
};

export type OccupiedBlock = {
  weekday: Weekday;
  start: string;
  end: string;
  occupiesStart: string;
  occupiesEnd: string;
  location: LessonLocation | null;
  studentId?: string;
  studentName: string;
  packageTitle: string;
  lessonId: string;
  scheduledAt: string;
  place?: Place;
  /** Deslocamento desde a aula anterior do dia (ou desde a base). */
  travelBefore?: TravelEstimate;
  /** Volta para a base: depois da última aula ou antes de uma aula na base. */
  travelAfter?: TravelEstimate;
  /** Horário repetido da semana anterior: o aluno ainda não tem aulas futuras. */
  projected?: boolean;
  /** "reserva" = horário reservado no cadastro; sem valor = aula real. */
  source?: "reserva";
  /** Reserva de aluno sem pacote ativo. */
  noActivePackage?: boolean;
};

export type CandidateSlot = {
  weekday: Weekday;
  time: string;
  occupiesStart: string;
  occupiesEnd: string;
  travelBefore?: TravelEstimate;
  travelAfter?: TravelEstimate;
  /** Deslocamento que este horário acrescenta ao dia do professor. */
  extraTravelMinutes?: number;
  extraTravelKm?: number;
};

export type AssistenteFormInput = {
  studentName: string;
  lessonsPerWeek: number;
  location: LessonLocation;
  studentSlots: StudentSlot[];
  teacherWindows: TeacherWindow[];
};

export type ScheduledLessonRow = {
  id: string;
  scheduled_at: string;
  location?: string | null;
  status?: string | null;
  rescheduled_from_id?: string | null;
  projected?: boolean;
  lesson_packages: {
    title: string;
    students: {
      id?: string;
      name: string;
      default_location?: string | null;
      lat?: number | null;
      lng?: number | null;
    } | null;
  } | null;
};

export function isWeekday(value: number): value is Weekday {
  return Number.isInteger(value) && value >= 1 && value <= 7;
}

export function defaultTeacherWindows(): TeacherWindow[] {
  return ([1, 2, 3, 4, 5] as const).map((weekday) => ({
    weekday,
    start: "10:00",
    end: "20:00",
  }));
}

export function parseTimeToMinutes(time: string): number | null {
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(time.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function minutesToTime(total: number): string {
  const day = 24 * 60;
  const normalized = ((total % day) + day) % day;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function normalizeTime(time: string): string | null {
  const minutes = parseTimeToMinutes(time);
  if (minutes == null) return null;
  return minutesToTime(minutes);
}

export function civilWeekBoundsSaoPaulo(now = new Date()) {
  const zoned = toZonedTime(now, APP_TIMEZONE);
  const weekStart = startOfWeek(zoned, { weekStartsOn: 1 });
  const startYmd = format(weekStart, "yyyy-MM-dd");
  const endYmd = format(addDays(weekStart, 6), "yyyy-MM-dd");
  return {
    start: fromZonedTime(`${startYmd}T00:00:00`, APP_TIMEZONE),
    end: fromZonedTime(`${endYmd}T23:59:59.999`, APP_TIMEZONE),
    startYmd,
    endYmd,
  };
}

/** Hoje + 6 dias: cada dia da semana aparece uma vez, a partir de hoje. */
export function rollingWeekBoundsSaoPaulo(now = new Date()) {
  const today = toZonedTime(now, APP_TIMEZONE);
  const startYmd = format(today, "yyyy-MM-dd");
  const endYmd = format(addDays(today, 6), "yyyy-MM-dd");
  return {
    start: fromZonedTime(`${startYmd}T00:00:00`, APP_TIMEZONE),
    end: fromZonedTime(`${endYmd}T23:59:59.999`, APP_TIMEZONE),
    startYmd,
    endYmd,
  };
}

/** Os 7 dias antes de hoje, usados para projetar quem ainda não renovou. */
export function previousWeekBoundsSaoPaulo(now = new Date()) {
  const today = toZonedTime(now, APP_TIMEZONE);
  const startYmd = format(addDays(today, -7), "yyyy-MM-dd");
  const endYmd = format(addDays(today, -1), "yyyy-MM-dd");
  return {
    start: fromZonedTime(`${startYmd}T00:00:00`, APP_TIMEZONE),
    end: fromZonedTime(`${endYmd}T23:59:59.999`, APP_TIMEZONE),
    startYmd,
    endYmd,
  };
}

const UPCOMING_GRID_STATUSES = new Set(["scheduled", "completed", "missed"]);
const PREVIOUS_GRID_STATUSES = new Set([
  "scheduled",
  "completed",
  "missed",
  "rescheduled",
]);

/**
 * Grade por aluno: vale o que ele tem a partir de hoje; quem não tem nenhuma
 * aula daqui para frente (pacote não renovado) entra com a semana anterior.
 * Na semana anterior, conta o horário original de uma aula remarcada, não a
 * aula avulsa criada pela remarcação.
 */
export function selectGridLessons(
  rows: ScheduledLessonRow[],
  todayStart: Date,
): ScheduledLessonRow[] {
  const upcoming: ScheduledLessonRow[] = [];
  const previous: ScheduledLessonRow[] = [];
  for (const row of rows) {
    const time = new Date(row.scheduled_at).getTime();
    if (Number.isNaN(time)) continue;
    const status = row.status ?? "scheduled";
    if (time >= todayStart.getTime()) {
      if (UPCOMING_GRID_STATUSES.has(status)) upcoming.push(row);
    } else if (PREVIOUS_GRID_STATUSES.has(status) && !row.rescheduled_from_id) {
      previous.push(row);
    }
  }

  const withUpcoming = new Set(
    upcoming
      .map((row) => row.lesson_packages?.students?.id)
      .filter((id): id is string => Boolean(id)),
  );
  const projected = previous
    .filter((row) => {
      const studentId = row.lesson_packages?.students?.id;
      return studentId && !withUpcoming.has(studentId);
    })
    .map((row) => ({ ...row, projected: true }));

  return [...upcoming, ...projected];
}

export function formatWeekLabel(bounds: {
  start: Date;
  end: Date;
}): string {
  const start = formatInSaoPaulo(bounds.start, "dd/MM");
  const end = formatInSaoPaulo(bounds.end, "dd/MM/yyyy");
  return `${start} a ${end}`;
}

function isoWeekdayFromIso(iso: string): Weekday | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const day = getISODay(toZonedTime(date, APP_TIMEZONE));
  return isWeekday(day) ? day : null;
}

function timeToMinutesFromIso(iso: string): number | null {
  const hhmm = formatInSaoPaulo(iso, "HH:mm");
  if (!hhmm) return null;
  return parseTimeToMinutes(hhmm);
}

export function rangesOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
) {
  return aStart < bEnd && bStart < aEnd;
}

export function occupiesRange(
  lessonStartMinutes: number,
  location: LessonLocation | null,
): { start: number; end: number } {
  const lessonEnd = lessonStartMinutes + LESSON_DURATION_MINUTES;
  if (location === "casa_aluno") {
    return {
      start: lessonStartMinutes - TRAVEL_BUFFER_MINUTES,
      end: lessonEnd + TRAVEL_BUFFER_MINUTES,
    };
  }
  return { start: lessonStartMinutes, end: lessonEnd };
}

export function teacherCoversLesson(
  windows: TeacherWindow[],
  weekday: Weekday,
  lessonStart: number,
): boolean {
  const lessonEnd = lessonStart + LESSON_DURATION_MINUTES;
  return windows.some((window) => {
    if (window.weekday !== weekday) return false;
    const start = parseTimeToMinutes(window.start);
    const end = parseTimeToMinutes(window.end);
    if (start == null || end == null) return false;
    return start <= lessonStart && lessonEnd <= end;
  });
}

export function conflictsWithOccupied(
  occupiesStart: number,
  occupiesEnd: number,
  weekday: Weekday,
  occupied: OccupiedBlock[],
): OccupiedBlock | null {
  for (const block of occupied) {
    if (block.weekday !== weekday) continue;
    const bStart = parseTimeToMinutes(block.occupiesStart);
    const bEnd = parseTimeToMinutes(block.occupiesEnd);
    if (bStart == null || bEnd == null) continue;
    if (rangesOverlap(occupiesStart, occupiesEnd, bStart, bEnd)) return block;
  }
  return null;
}

/** Aulas sem local cadastrado contam como na base, como online. */
export function placeForLocation(
  location: LessonLocation | null,
  base: Place,
  student: Place,
): Place {
  return location === "casa_aluno" ? student : base;
}

export function blockPlace(block: OccupiedBlock, base: Place): Place {
  return (
    block.place ??
    placeForLocation(
      block.location,
      base,
      studentPlace(block.studentId ?? block.lessonId),
    )
  );
}

export function routeStopsForDay(
  blocks: OccupiedBlock[],
  weekday: Weekday,
  base: Place,
): RouteStop[] {
  const stops: RouteStop[] = [];
  for (const block of blocks) {
    if (block.weekday !== weekday) continue;
    const start = parseTimeToMinutes(block.start);
    if (start == null) continue;
    stops.push({
      start,
      end: start + LESSON_DURATION_MINUTES,
      place: blockPlace(block, base),
    });
  }
  return stops.sort((a, b) => a.start - b.start);
}

/**
 * Preenche o deslocamento de cada aula seguindo a ordem do dia:
 * base → aula 1 → aula 2 → … → base.
 */
export function withDayTravel(
  blocks: OccupiedBlock[],
  base: Place,
): OccupiedBlock[] {
  const byDay = new Map<Weekday, OccupiedBlock[]>();
  for (const block of blocks) {
    const day = byDay.get(block.weekday) ?? [];
    day.push(block);
    byDay.set(block.weekday, day);
  }

  const result: OccupiedBlock[] = [];
  for (const day of byDay.values()) {
    day.sort((a, b) => a.start.localeCompare(b.start));
    const places = day.map((block) => blockPlace(block, base));
    // A volta para a base sai logo depois da aula, não antes da próxima.
    const travels = places.map((place, index) => {
      const previous = index > 0 ? places[index - 1]! : base;
      const next = index < places.length - 1 ? places[index + 1]! : base;
      const goingHome = isBase(next) && !isBase(place);
      return {
        before: isBase(place) ? NO_TRAVEL : estimateTravel(previous, place),
        after:
          goingHome || index === places.length - 1
            ? estimateTravel(place, base)
            : NO_TRAVEL,
      };
    });
    day.forEach((block, index) => {
      const { before, after } = travels[index]!;
      const start = parseTimeToMinutes(block.start) ?? 0;
      result.push({
        ...block,
        place: places[index]!,
        travelBefore: before,
        travelAfter: after,
        occupiesStart: minutesToTime(Math.max(0, start - before.minutes)),
        occupiesEnd: minutesToTime(
          Math.min(24 * 60 - 1, start + LESSON_DURATION_MINUTES + after.minutes),
        ),
      });
    });
  }
  return result.sort(
    (a, b) => a.weekday - b.weekday || a.start.localeCompare(b.start),
  );
}

export function buildOccupiedBlocks(
  lessons: ScheduledLessonRow[],
  base: Place = basePlace(),
): OccupiedBlock[] {
  const blocks = lessons
    .map((lesson): OccupiedBlock | null => {
      const startMinutes = timeToMinutesFromIso(lesson.scheduled_at);
      if (startMinutes == null) return null;
      const weekday = isoWeekdayFromIso(lesson.scheduled_at);
      if (!weekday) return null;
      const pkg = lesson.lesson_packages;
      const student = pkg?.students;
      const location = effectiveLocation(
        lesson.location,
        student?.default_location,
      );
      const coords =
        student?.lat != null && student?.lng != null
          ? { lat: student.lat, lng: student.lng }
          : null;
      const place = placeForLocation(
        location,
        base,
        studentPlace(student?.id ?? lesson.id, coords),
      );
      const occupies = occupiesRange(startMinutes, location);
      return {
        weekday,
        start: minutesToTime(startMinutes),
        end: minutesToTime(startMinutes + LESSON_DURATION_MINUTES),
        occupiesStart: minutesToTime(occupies.start),
        occupiesEnd: minutesToTime(occupies.end),
        location,
        ...(student?.id ? { studentId: student.id } : {}),
        studentName: student?.name ?? "Aluno",
        packageTitle: pkg?.title ?? "Pacote",
        lessonId: lesson.id,
        scheduledAt: lesson.scheduled_at,
        place,
        ...(lesson.projected ? { projected: true } : {}),
      };
    })
    .filter((block): block is OccupiedBlock => block != null);

  return withDayTravel(blocks, base);
}

export function findCandidateSlots(input: {
  studentSlots: StudentSlot[];
  teacherWindows: TeacherWindow[];
  occupied: OccupiedBlock[];
  location: LessonLocation;
  /** Onde fica o aluno; sem isso, vale a estimativa padrão de deslocamento. */
  place?: Place;
  base?: Place;
}): CandidateSlot[] {
  const base = input.base ?? basePlace();
  const place = placeForLocation(
    input.location,
    base,
    input.place ?? studentPlace("novo"),
  );
  const seen = new Set<string>();
  const candidates: CandidateSlot[] = [];
  const stopsByDay = new Map<Weekday, RouteStop[]>();

  for (const slot of input.studentSlots) {
    if (!isWeekday(slot.weekday)) continue;
    const lessonStart = parseTimeToMinutes(slot.time);
    if (lessonStart == null) continue;
    const time = minutesToTime(lessonStart);
    const key = `${slot.weekday}-${time}`;
    if (seen.has(key)) continue;
    seen.add(key);

    if (!teacherCoversLesson(input.teacherWindows, slot.weekday, lessonStart)) {
      continue;
    }

    let stops = stopsByDay.get(slot.weekday);
    if (!stops) {
      stops = routeStopsForDay(input.occupied, slot.weekday, base);
      stopsByDay.set(slot.weekday, stops);
    }
    const fit = checkInsertion(
      stops,
      { start: lessonStart, end: lessonStart + LESSON_DURATION_MINUTES, place },
      base,
    );
    if (!fit.ok) continue;

    candidates.push({
      weekday: slot.weekday,
      time,
      occupiesStart: minutesToTime(Math.max(0, lessonStart - fit.before.minutes)),
      occupiesEnd: minutesToTime(
        Math.min(
          24 * 60 - 1,
          lessonStart + LESSON_DURATION_MINUTES + fit.after.minutes,
        ),
      ),
      travelBefore: fit.before,
      travelAfter: fit.after,
      extraTravelMinutes: fit.extraMinutes,
      extraTravelKm: fit.extraKm,
    });
  }

  return candidates.sort(
    (a, b) => a.weekday - b.weekday || a.time.localeCompare(b.time),
  );
}

export function formatOccupiedLabel(block: OccupiedBlock): string {
  const location = block.location ? ` · ${LOCATION_SHORT[block.location]}` : "";
  const projected = block.projected ? " · pela semana passada" : "";
  return `${WEEKDAY_SHORT[block.weekday]} ${block.start} ${block.studentName}${location}${projected}`;
}

function parseWeekday(value: unknown): Weekday | null {
  const n = typeof value === "string" ? Number(value) : value;
  if (typeof n !== "number" || !isWeekday(n)) return null;
  return n;
}

export function parseTeacherWindows(
  raw: unknown,
): { ok: true; value: TeacherWindow[] } | { ok: false; error: string } {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { ok: false, error: "Informe a disponibilidade do professor" };
  }
  if (raw.length > 21) {
    return { ok: false, error: "Muitos intervalos do professor" };
  }

  const teacherWindows: TeacherWindow[] = [];
  for (const window of raw) {
    if (!window || typeof window !== "object") {
      return { ok: false, error: "Horário do professor inválido" };
    }
    const item = window as Record<string, unknown>;
    const weekday = parseWeekday(item.weekday);
    const start =
      typeof item.start === "string" ? normalizeTime(item.start) : null;
    const end = typeof item.end === "string" ? normalizeTime(item.end) : null;
    if (!weekday || !start || !end) {
      return {
        ok: false,
        error: "Cada intervalo do professor precisa de dia, início e fim",
      };
    }
    const startMin = parseTimeToMinutes(start);
    const endMin = parseTimeToMinutes(end);
    if (startMin == null || endMin == null || endMin <= startMin) {
      return {
        ok: false,
        error: "O fim do horário do professor deve ser depois do início",
      };
    }
    teacherWindows.push({ weekday, start, end });
  }

  return { ok: true, value: teacherWindows };
}

export function teacherWindowsFromStored(raw: unknown): TeacherWindow[] {
  const parsed = parseTeacherWindows(raw);
  return parsed.ok ? parsed.value : defaultTeacherWindows();
}

export function parseStudentSlots(
  raw: unknown,
): { ok: true; value: StudentSlot[] } | { ok: false; error: string } {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { ok: false, error: "Informe pelo menos um horário do aluno" };
  }
  if (raw.length > 20) {
    return { ok: false, error: "Muitos horários do aluno" };
  }

  const studentSlots: StudentSlot[] = [];
  for (const slot of raw) {
    if (!slot || typeof slot !== "object") {
      return { ok: false, error: "Horário do aluno inválido" };
    }
    const item = slot as Record<string, unknown>;
    const weekday = parseWeekday(item.weekday);
    const time =
      typeof item.time === "string" ? normalizeTime(item.time) : null;
    if (!weekday || !time) {
      return { ok: false, error: "Cada horário do aluno precisa de dia e hora" };
    }
    studentSlots.push({ weekday, time });
  }

  return { ok: true, value: studentSlots };
}

export function studentSlotsFromStored(raw: unknown): StudentSlot[] {
  const parsed = parseStudentSlots(raw);
  return parsed.ok ? parsed.value : [];
}

export function formatStudentSlots(slots: StudentSlot[]): string {
  if (slots.length === 0) return "Nenhum horário";
  return slots
    .map((slot) => `${WEEKDAY_SHORT[slot.weekday]} ${compactClock(slot.time)}`)
    .join(" · ");
}

function compactClock(time: string): string {
  return time.endsWith(":00") ? `${time.slice(0, 2)}h` : time;
}

function formatDaySpan(days: Weekday[]): string {
  const unique = [...new Set(days)].sort((a, b) => a - b);
  if (unique.length === 1) return WEEKDAY_SHORT[unique[0]!];
  const consecutive = unique.every(
    (day, index) => index === 0 || day === unique[index - 1]! + 1,
  );
  if (consecutive && unique.length >= 3) {
    return `${WEEKDAY_SHORT[unique[0]!]}–${WEEKDAY_SHORT[unique[unique.length - 1]!]}`;
  }
  return unique.map((day) => WEEKDAY_SHORT[day]).join(", ");
}

export function summarizeTeacherWindows(windows: TeacherWindow[]): string {
  if (windows.length === 0) return "Nenhum horário";

  const groups = new Map<string, Weekday[]>();
  const sorted = [...windows].sort(
    (a, b) => a.weekday - b.weekday || a.start.localeCompare(b.start),
  );
  for (const window of sorted) {
    const key = `${window.start}-${window.end}`;
    const days = groups.get(key) ?? [];
    days.push(window.weekday);
    groups.set(key, days);
  }

  return [...groups.entries()]
    .map(([range, days]) => {
      const [start, end] = range.split("-");
      return `${formatDaySpan(days)} ${compactClock(start!)}–${compactClock(end!)}`;
    })
    .join(" · ");
}

export function parseAssistenteFormInput(
  raw: unknown,
): { ok: true; value: AssistenteFormInput } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "Dados inválidos" };
  }

  const data = raw as Record<string, unknown>;
  const studentName =
    typeof data.studentName === "string" ? data.studentName.trim() : "";
  if (!studentName) {
    return { ok: false, error: "Informe o nome do aluno" };
  }

  const lessonsPerWeek = Number(data.lessonsPerWeek);
  if (!Number.isInteger(lessonsPerWeek) || lessonsPerWeek < 1 || lessonsPerWeek > 14) {
    return { ok: false, error: "Aulas por semana deve ser entre 1 e 14" };
  }

  const location =
    typeof data.location === "string" ? data.location : "";
  if (!isLessonLocation(location)) {
    return { ok: false, error: "Selecione o local da aula" };
  }

  const studentSlots = parseStudentSlots(data.studentSlots);
  if (!studentSlots.ok) return studentSlots;

  const windows = parseTeacherWindows(data.teacherWindows);
  if (!windows.ok) return windows;

  return {
    ok: true,
    value: {
      studentName,
      lessonsPerWeek,
      location,
      studentSlots: studentSlots.value,
      teacherWindows: windows.value,
    },
  };
}
