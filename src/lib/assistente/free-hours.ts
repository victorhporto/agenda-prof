import { LOCATION_SHORT, type LessonLocation } from "@/lib/lessons/location";
import {
  WEEKDAYS,
  minutesToTime,
  occupiesRange,
  parseTimeToMinutes,
  rangesOverlap,
  type OccupiedBlock,
  type TeacherWindow,
  type Weekday,
} from "@/lib/assistente/occupancy";

export type TimelineKind = "free" | "lesson" | "travel" | "outside";

export type TimelineSegment = {
  weekday: Weekday;
  start: string;
  end: string;
  kind: TimelineKind;
  studentName?: string;
  packageTitle?: string;
  lessonId?: string;
  location?: LessonLocation | null;
  travelSide?: "before" | "after";
};

export type DayFreeHours = {
  weekday: Weekday;
  windows: { start: string; end: string }[];
  segments: TimelineSegment[];
  freeMinutes: number;
};

type MinuteRange = { start: number; end: number };

type OccupiedSpan = {
  block: OccupiedBlock;
  lesson: MinuteRange;
  occupy: MinuteRange;
};

function formatClock(total: number): string {
  if (total >= 24 * 60) return "24:00";
  if (total <= 0) return "00:00";
  return minutesToTime(total);
}

function durationOf(segment: { start: string; end: string }): number {
  const start = parseTimeToMinutes(segment.start);
  const end = parseTimeToMinutes(segment.end);
  if (start == null || end == null || end <= start) return 0;
  return end - start;
}

export function formatMinutesLabel(minutes: number): string {
  if (minutes <= 0) return "0h";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours && rest) return `${hours}h${String(rest).padStart(2, "0")}`;
  if (hours) return `${hours}h`;
  return `${rest} min`;
}

function mergeDayWindows(
  windows: TeacherWindow[],
  weekday: Weekday,
): MinuteRange[] {
  const ranges: MinuteRange[] = [];
  for (const window of windows) {
    if (window.weekday !== weekday) continue;
    const start = parseTimeToMinutes(window.start);
    const end = parseTimeToMinutes(window.end);
    if (start == null || end == null || end <= start) continue;
    ranges.push({ start, end });
  }
  ranges.sort((a, b) => a.start - b.start);

  const merged: MinuteRange[] = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range.start <= last.end) {
      last.end = Math.max(last.end, range.end);
    } else {
      merged.push({ ...range });
    }
  }
  return merged;
}

function spansForDay(
  occupied: OccupiedBlock[],
  weekday: Weekday,
): OccupiedSpan[] {
  return occupied
    .filter((block) => block.weekday === weekday)
    .map((block) => {
      const lessonStart = parseTimeToMinutes(block.start);
      const lessonEnd = parseTimeToMinutes(block.end);
      if (lessonStart == null || lessonEnd == null) return null;
      const occupy = occupiesRange(lessonStart, block.location);
      return {
        block,
        lesson: { start: lessonStart, end: lessonEnd },
        occupy: {
          start: Math.max(0, occupy.start),
          end: Math.min(24 * 60, occupy.end),
        },
      } satisfies OccupiedSpan;
    })
    .filter((span): span is OccupiedSpan => span != null)
    .sort((a, b) => a.lesson.start - b.lesson.start);
}

function coveredByWindow(start: number, end: number, windows: MinuteRange[]) {
  return windows.some((window) => start >= window.start && end <= window.end);
}

function overlappingLesson(
  start: number,
  end: number,
  spans: OccupiedSpan[],
): OccupiedSpan | null {
  return (
    spans.find((span) =>
      rangesOverlap(start, end, span.lesson.start, span.lesson.end),
    ) ?? null
  );
}

function overlappingOccupy(
  start: number,
  end: number,
  spans: OccupiedSpan[],
): OccupiedSpan | null {
  return (
    spans.find((span) =>
      rangesOverlap(start, end, span.occupy.start, span.occupy.end),
    ) ?? null
  );
}

function classifyInterval(
  start: number,
  end: number,
  weekday: Weekday,
  windows: MinuteRange[],
  spans: OccupiedSpan[],
  displayStart: number,
  displayEnd: number,
): TimelineSegment | null {
  const lessonSpan = overlappingLesson(start, end, spans);
  if (lessonSpan) {
    return {
      weekday,
      start: formatClock(start),
      end: formatClock(end),
      kind: "lesson",
      studentName: lessonSpan.block.studentName,
      packageTitle: lessonSpan.block.packageTitle,
      lessonId: lessonSpan.block.lessonId,
      location: lessonSpan.block.location,
    };
  }

  const travelSpan = overlappingOccupy(start, end, spans);
  if (travelSpan) {
    const travelSide: "before" | "after" =
      end <= travelSpan.lesson.start ? "before" : "after";
    return {
      weekday,
      start: formatClock(start),
      end: formatClock(end),
      kind: "travel",
      studentName: travelSpan.block.studentName,
      packageTitle: travelSpan.block.packageTitle,
      lessonId: travelSpan.block.lessonId,
      location: travelSpan.block.location,
      travelSide,
    };
  }

  if (coveredByWindow(start, end, windows)) {
    return {
      weekday,
      start: formatClock(start),
      end: formatClock(end),
      kind: "free",
    };
  }

  const insideDisplay = start >= displayStart && end <= displayEnd;
  const betweenWindows =
    windows.length >= 1 &&
    start >= windows[0]!.start &&
    end <= windows[windows.length - 1]!.end;
  if (insideDisplay && betweenWindows) {
    return {
      weekday,
      start: formatClock(start),
      end: formatClock(end),
      kind: "outside",
    };
  }

  return null;
}

function canMerge(a: TimelineSegment, b: TimelineSegment) {
  if (a.kind !== b.kind || a.end !== b.start) return false;
  if (a.kind === "free" || a.kind === "outside") return true;
  return a.lessonId === b.lessonId && a.travelSide === b.travelSide;
}

function mergeSegments(segments: TimelineSegment[]): TimelineSegment[] {
  const merged: TimelineSegment[] = [];
  for (const segment of segments) {
    const last = merged[merged.length - 1];
    if (last && canMerge(last, segment)) {
      last.end = segment.end;
      continue;
    }
    merged.push({ ...segment });
  }
  return merged;
}

function collectPoints(
  windows: MinuteRange[],
  spans: OccupiedSpan[],
  displayStart: number,
  displayEnd: number,
): number[] {
  const points = new Set<number>([displayStart, displayEnd]);
  for (const window of windows) {
    if (window.start >= displayStart && window.start <= displayEnd) {
      points.add(window.start);
    }
    if (window.end >= displayStart && window.end <= displayEnd) {
      points.add(window.end);
    }
  }
  for (const span of spans) {
    for (const value of [
      span.lesson.start,
      span.lesson.end,
      span.occupy.start,
      span.occupy.end,
    ]) {
      if (value >= displayStart && value <= displayEnd) points.add(value);
    }
  }
  return [...points].sort((a, b) => a - b);
}

function displayBounds(
  windows: MinuteRange[],
  spans: OccupiedSpan[],
): MinuteRange | null {
  const candidates: number[] = [];
  for (const window of windows) {
    candidates.push(window.start, window.end);
  }
  for (const span of spans) {
    candidates.push(span.occupy.start, span.occupy.end);
  }
  if (candidates.length === 0) return null;
  return {
    start: Math.min(...candidates),
    end: Math.max(...candidates),
  };
}

function buildDayFreeHours(
  weekday: Weekday,
  teacherWindows: TeacherWindow[],
  occupied: OccupiedBlock[],
): DayFreeHours | null {
  const windows = mergeDayWindows(teacherWindows, weekday);
  const spans = spansForDay(occupied, weekday);
  if (windows.length === 0 && spans.length === 0) return null;

  const bounds = displayBounds(windows, spans);
  if (!bounds) return null;

  const points = collectPoints(windows, spans, bounds.start, bounds.end);
  const raw: TimelineSegment[] = [];
  for (let index = 0; index < points.length - 1; index++) {
    const start = points[index]!;
    const end = points[index + 1]!;
    if (end <= start) continue;
    const segment = classifyInterval(
      start,
      end,
      weekday,
      windows,
      spans,
      bounds.start,
      bounds.end,
    );
    if (segment) raw.push(segment);
  }

  const segments = mergeSegments(raw);
  const freeMinutes = segments
    .filter((segment) => segment.kind === "free")
    .reduce((sum, segment) => sum + durationOf(segment), 0);

  return {
    weekday,
    windows: windows.map((window) => ({
      start: formatClock(window.start),
      end: formatClock(window.end),
    })),
    segments,
    freeMinutes,
  };
}

export function buildWeekFreeHours(input: {
  teacherWindows: TeacherWindow[];
  occupied: OccupiedBlock[];
}): DayFreeHours[] {
  const weekdays = new Set<Weekday>();
  for (const window of input.teacherWindows) {
    weekdays.add(window.weekday);
  }
  for (const block of input.occupied) {
    weekdays.add(block.weekday);
  }

  return WEEKDAYS.filter((day) => weekdays.has(day))
    .map((day) =>
      buildDayFreeHours(day, input.teacherWindows, input.occupied),
    )
    .filter((day): day is DayFreeHours => day != null);
}

export function weekFreeMinutes(days: DayFreeHours[]): number {
  return days.reduce((sum, day) => sum + day.freeMinutes, 0);
}

export function travelLabel(segment: TimelineSegment): string {
  const name = segment.studentName ?? "aluno";
  if (segment.travelSide === "before") return `Deslocamento até ${name}`;
  if (segment.travelSide === "after") return `Deslocamento após ${name}`;
  return `Locomoção · ${name}`;
}

export function lessonPlaceLabel(location: LessonLocation | null | undefined) {
  return location ? LOCATION_SHORT[location] : null;
}

export function segmentDurationMinutes(segment: TimelineSegment): number {
  return durationOf(segment);
}
