import { addDays, format, getISODay, startOfWeek } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { APP_TIMEZONE, formatInSaoPaulo } from "@/lib/timezone";
import {
  LOCATION_SHORT,
  isLessonLocation,
  effectiveLocation,
  type LessonLocation,
} from "@/lib/lessons/location";

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
  studentName: string;
  packageTitle: string;
  lessonId: string;
  scheduledAt: string;
};

export type CandidateSlot = {
  weekday: Weekday;
  time: string;
  occupiesStart: string;
  occupiesEnd: string;
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
  lesson_packages: {
    title: string;
    students: {
      name: string;
      default_location?: string | null;
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

export function buildOccupiedBlocks(
  lessons: ScheduledLessonRow[],
): OccupiedBlock[] {
  return lessons
    .map((lesson) => {
      const startMinutes = timeToMinutesFromIso(lesson.scheduled_at);
      if (startMinutes == null) return null;
      const weekday = isoWeekdayFromIso(lesson.scheduled_at);
      if (!weekday) return null;
      const pkg = lesson.lesson_packages;
      const location = effectiveLocation(
        lesson.location,
        pkg?.students?.default_location,
      );
      const occupies = occupiesRange(startMinutes, location);
      return {
        weekday,
        start: minutesToTime(startMinutes),
        end: minutesToTime(startMinutes + LESSON_DURATION_MINUTES),
        occupiesStart: minutesToTime(occupies.start),
        occupiesEnd: minutesToTime(occupies.end),
        location,
        studentName: pkg?.students?.name ?? "Aluno",
        packageTitle: pkg?.title ?? "Pacote",
        lessonId: lesson.id,
        scheduledAt: lesson.scheduled_at,
      } satisfies OccupiedBlock;
    })
    .filter((block): block is OccupiedBlock => block != null)
    .sort((a, b) => a.weekday - b.weekday || a.start.localeCompare(b.start));
}

export function findCandidateSlots(input: {
  studentSlots: StudentSlot[];
  teacherWindows: TeacherWindow[];
  occupied: OccupiedBlock[];
  location: LessonLocation;
}): CandidateSlot[] {
  const seen = new Set<string>();
  const candidates: CandidateSlot[] = [];

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

    const occupies = occupiesRange(lessonStart, input.location);
    if (
      conflictsWithOccupied(
        occupies.start,
        occupies.end,
        slot.weekday,
        input.occupied,
      )
    ) {
      continue;
    }

    candidates.push({
      weekday: slot.weekday,
      time,
      occupiesStart: minutesToTime(occupies.start),
      occupiesEnd: minutesToTime(occupies.end),
    });
  }

  return candidates.sort(
    (a, b) => a.weekday - b.weekday || a.time.localeCompare(b.time),
  );
}

export function formatOccupiedLabel(block: OccupiedBlock): string {
  const location = block.location ? ` · ${LOCATION_SHORT[block.location]}` : "";
  return `${WEEKDAY_SHORT[block.weekday]} ${block.start} ${block.studentName}${location}`;
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
