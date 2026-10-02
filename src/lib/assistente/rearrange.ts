import {
  LESSON_DURATION_MINUTES,
  WEEKDAYS,
  blockPlace,
  findCandidateSlots,
  minutesToTime,
  parseStudentSlots,
  parseTeacherWindows,
  parseTimeToMinutes,
  placeForLocation,
  routeStopsForDay,
  withDayTravel,
  type CandidateSlot,
  type OccupiedBlock,
  type StudentSlot,
  type TeacherWindow,
  type Weekday,
} from "@/lib/assistente/occupancy";
import type { LessonLocation } from "@/lib/lessons/location";
import {
  basePlace,
  checkInsertion,
  dayRouteCost,
  estimateTravel,
  studentPlace,
  type Place,
  type RouteStop,
} from "@/lib/geo/travel";

export const MAX_REARRANGE_STUDENTS = 10;
const MAX_SEARCH_NODES = 200_000;

export type RearrangeInput = {
  students: { studentId: string; studentSlots: StudentSlot[] }[];
  teacherWindows: TeacherWindow[];
};

export type MovingStudent = {
  studentId: string;
  studentName: string;
  location: LessonLocation | null;
  place: Place;
  lessonsPerWeek: number;
  current: OccupiedBlock[];
  studentSlots: StudentSlot[];
  candidates: CandidateSlot[];
};

export type PlanEntry = {
  studentId: string;
  studentName: string;
  slots: CandidateSlot[];
  keptCount: number;
  missing: number;
};

export type WeekTravel = { minutes: number; km: number };

export type RearrangePlan = {
  entries: PlanEntry[];
  placedLessons: number;
  totalLessons: number;
  /** Deslocamento semanal estimado da grade atual e da grade proposta. */
  currentTravel: WeekTravel;
  proposedTravel: WeekTravel;
};

export function parseRearrangeInput(
  raw: unknown,
): { ok: true; value: RearrangeInput } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "Dados inválidos" };
  }
  const data = raw as Record<string, unknown>;
  if (!Array.isArray(data.students) || data.students.length === 0) {
    return { ok: false, error: "Selecione pelo menos um aluno" };
  }
  if (data.students.length > MAX_REARRANGE_STUDENTS) {
    return {
      ok: false,
      error: `Selecione no máximo ${MAX_REARRANGE_STUDENTS} alunos`,
    };
  }

  const seen = new Set<string>();
  const students: RearrangeInput["students"] = [];
  for (const item of data.students) {
    if (!item || typeof item !== "object") {
      return { ok: false, error: "Aluno inválido" };
    }
    const row = item as Record<string, unknown>;
    const studentId =
      typeof row.studentId === "string" ? row.studentId.trim() : "";
    if (!studentId || studentId.length > 100) {
      return { ok: false, error: "Aluno inválido" };
    }
    if (seen.has(studentId)) continue;
    seen.add(studentId);

    const slots = parseStudentSlots(row.studentSlots);
    if (!slots.ok) return slots;
    students.push({ studentId, studentSlots: slots.value });
  }

  const windows = parseTeacherWindows(data.teacherWindows);
  if (!windows.ok) return windows;

  return { ok: true, value: { students, teacherWindows: windows.value } };
}

function dominantLocation(blocks: OccupiedBlock[]): LessonLocation | null {
  const counts = new Map<LessonLocation | null, number>();
  for (const block of blocks) {
    counts.set(block.location, (counts.get(block.location) ?? 0) + 1);
  }
  let best: LessonLocation | null = null;
  let bestCount = 0;
  for (const [location, count] of counts) {
    if (count > bestCount) {
      best = location;
      bestCount = count;
    }
  }
  return best;
}

function isCurrentSlot(student: MovingStudent, slot: CandidateSlot) {
  return student.current.some(
    (block) => block.weekday === slot.weekday && block.start === slot.time,
  );
}

function homePlace(student: string, current: OccupiedBlock[], base: Place) {
  const atHome = current.find((block) => block.location === "casa_aluno");
  return atHome ? blockPlace(atHome, base) : studentPlace(student);
}

/** Atual primeiro; depois o horário que menos aumenta o deslocamento do dia. */
function compareCandidates(student: MovingStudent) {
  return (a: CandidateSlot, b: CandidateSlot) =>
    Number(isCurrentSlot(student, b)) - Number(isCurrentSlot(student, a)) ||
    (a.extraTravelMinutes ?? 0) - (b.extraTravelMinutes ?? 0) ||
    (a.extraTravelKm ?? 0) - (b.extraTravelKm ?? 0) ||
    a.weekday - b.weekday ||
    a.time.localeCompare(b.time);
}

export function buildRearrangeContext(
  occupied: OccupiedBlock[],
  input: RearrangeInput,
  base: Place = basePlace(),
):
  | { ok: true; fixed: OccupiedBlock[]; moving: MovingStudent[] }
  | { ok: false; error: string } {
  const selected = new Set(input.students.map((student) => student.studentId));
  const fixed = withDayTravel(
    occupied.filter(
      (block) => !block.studentId || !selected.has(block.studentId),
    ),
    base,
  );

  const moving: MovingStudent[] = [];
  for (const student of input.students) {
    const current = occupied.filter(
      (block) => block.studentId === student.studentId,
    );
    if (current.length === 0) {
      return {
        ok: false,
        error: "Um dos alunos selecionados não tem aula agendada nesta semana",
      };
    }
    const location = dominantLocation(current);
    const home = homePlace(student.studentId, current, base);
    const movingStudent: MovingStudent = {
      studentId: student.studentId,
      studentName: current[0]!.studentName,
      location,
      place: placeForLocation(location, base, home),
      lessonsPerWeek: current.length,
      current,
      studentSlots: student.studentSlots,
      candidates: [],
    };
    movingStudent.candidates = findCandidateSlots({
      studentSlots: student.studentSlots,
      teacherWindows: input.teacherWindows,
      occupied: fixed,
      location: location ?? "online",
      place: home,
      base,
    }).sort(compareCandidates(movingStudent));
    moving.push(movingStudent);
  }

  return { ok: true, fixed, moving };
}

type Pick = { weekday: Weekday; stop: RouteStop };

function candidateStop(student: MovingStudent, slot: CandidateSlot): Pick | null {
  const start = parseTimeToMinutes(slot.time);
  if (start == null) return null;
  return {
    weekday: slot.weekday,
    stop: { start, end: start + LESSON_DURATION_MINUTES, place: student.place },
  };
}

function weekTravel(days: Map<Weekday, RouteStop[]>, base: Place): WeekTravel {
  let minutes = 0;
  let km = 0;
  for (const stops of days.values()) {
    if (stops.length === 0) continue;
    const cost = dayRouteCost(stops, base);
    minutes += cost.minutes;
    km += cost.km;
  }
  return { minutes, km };
}

function fixedDays(fixed: OccupiedBlock[], base: Place) {
  const days = new Map<Weekday, RouteStop[]>();
  for (const weekday of WEEKDAYS) {
    days.set(weekday, routeStopsForDay(fixed, weekday, base));
  }
  return days;
}

/** Recalcula o deslocamento de cada aula escolhida na sequência final do dia. */
function withFinalTravel(
  slot: CandidateSlot,
  place: Place,
  days: Map<Weekday, RouteStop[]>,
  base: Place,
): CandidateSlot {
  const start = parseTimeToMinutes(slot.time) ?? 0;
  const stops = (days.get(slot.weekday) ?? []).filter(
    (stop) => stop.start !== start,
  );
  const fit = checkInsertion(
    stops,
    { start, end: start + LESSON_DURATION_MINUTES, place },
    base,
  );
  const isLast = !stops.some((stop) => stop.start > start);
  const after = isLast ? estimateTravel(place, base) : fit.after;
  return {
    ...slot,
    travelBefore: fit.before,
    travelAfter: after,
    occupiesStart: minutesToTime(Math.max(0, start - fit.before.minutes)),
    occupiesEnd: minutesToTime(
      Math.min(24 * 60 - 1, start + LESSON_DURATION_MINUTES + after.minutes),
    ),
  };
}

/**
 * Busca exaustiva (com poda e teto de nós) do plano que coloca mais aulas;
 * empatando, mantém mais aulas no horário atual; empatando de novo, gera
 * menos deslocamento na semana. Cada aluno no máximo uma aula por dia, e cada
 * aula precisa caber na sequência do dia com o tempo de deslocamento.
 */
export function solveRearrangement(
  moving: MovingStudent[],
  fixed: OccupiedBlock[] = [],
  base: Place = basePlace(),
): RearrangePlan {
  const order = moving
    .map((student, index) => ({ student, index }))
    .sort(
      (a, b) =>
        a.student.candidates.length - b.student.candidates.length ||
        a.index - b.index,
    );

  const units: number[] = [];
  for (let position = 0; position < order.length; position++) {
    for (let k = 0; k < order[position]!.student.lessonsPerWeek; k++) {
      units.push(position);
    }
  }

  const picksByPosition = order.map(({ student }) =>
    student.candidates.map((slot) => candidateStop(student, slot)),
  );
  const kept = order.map(({ student }) =>
    student.candidates.map((slot) => isCurrentSlot(student, slot)),
  );

  const days = fixedDays(fixed, base);
  const chosen: number[][] = order.map(() => []);
  const skipped = order.map(() => false);
  let best = {
    placed: -1,
    kept: -1,
    travel: { minutes: Infinity, km: Infinity } as WeekTravel,
    picks: order.map(() => [] as number[]),
  };
  let nodes = 0;

  function fits(pick: Pick, position: number) {
    for (const index of chosen[position]!) {
      if (picksByPosition[position]![index]!.weekday === pick.weekday) {
        return false;
      }
    }
    return checkInsertion(days.get(pick.weekday)!, pick.stop, base).ok;
  }

  function isBetter(placed: number, keptCount: number, travel: WeekTravel) {
    if (placed !== best.placed) return placed > best.placed;
    if (keptCount !== best.kept) return keptCount > best.kept;
    if (travel.minutes !== best.travel.minutes) {
      return travel.minutes < best.travel.minutes;
    }
    return travel.km < best.travel.km - 1e-9;
  }

  function search(unit: number, placed: number, keptCount: number) {
    nodes++;
    if (nodes > MAX_SEARCH_NODES) return;
    const remaining = units.length - unit;
    if (placed + remaining < best.placed) return;
    if (placed + remaining === best.placed && keptCount + remaining < best.kept) {
      return;
    }
    if (unit === units.length) {
      const travel = weekTravel(days, base);
      if (isBetter(placed, keptCount, travel)) {
        best = {
          placed,
          kept: keptCount,
          travel,
          picks: chosen.map((picks) => [...picks]),
        };
      }
      return;
    }

    const position = units[unit]!;
    if (!skipped[position]) {
      const picks = chosen[position]!;
      const from = picks.length ? picks[picks.length - 1]! + 1 : 0;
      for (let index = from; index < picksByPosition[position]!.length; index++) {
        const pick = picksByPosition[position]![index];
        if (!pick || !fits(pick, position)) continue;
        const dayStops = days.get(pick.weekday)!;
        picks.push(index);
        dayStops.push(pick.stop);
        search(
          unit + 1,
          placed + 1,
          keptCount + (kept[position]![index] ? 1 : 0),
        );
        dayStops.pop();
        picks.pop();
      }
    }

    const wasSkipped = skipped[position]!;
    skipped[position] = true;
    search(unit + 1, placed, keptCount);
    skipped[position] = wasSkipped;
  }

  search(0, 0, 0);

  const finalDays = fixedDays(fixed, base);
  order.forEach((_, position) => {
    for (const pick of best.picks[position] ?? []) {
      const stop = picksByPosition[position]![pick];
      if (stop) finalDays.get(stop.weekday)!.push(stop.stop);
    }
  });

  const currentDays = fixedDays(fixed, base);
  for (const student of moving) {
    for (const block of student.current) {
      const start = parseTimeToMinutes(block.start);
      if (start == null) continue;
      currentDays.get(block.weekday)!.push({
        start,
        end: start + LESSON_DURATION_MINUTES,
        place: blockPlace(block, base),
      });
    }
  }

  const byIndex = new Map<number, PlanEntry>();
  order.forEach(({ student, index }, position) => {
    const slots = (best.picks[position] ?? [])
      .map((pick) =>
        withFinalTravel(student.candidates[pick]!, student.place, finalDays, base),
      )
      .sort((a, b) => a.weekday - b.weekday || a.time.localeCompare(b.time));
    byIndex.set(index, {
      studentId: student.studentId,
      studentName: student.studentName,
      slots,
      keptCount: slots.filter((slot) => isCurrentSlot(student, slot)).length,
      missing: student.lessonsPerWeek - slots.length,
    });
  });

  const entries = moving.map((_, index) => byIndex.get(index)!);
  return {
    entries,
    placedLessons: entries.reduce((sum, entry) => sum + entry.slots.length, 0),
    totalLessons: moving.reduce(
      (sum, student) => sum + student.lessonsPerWeek,
      0,
    ),
    currentTravel: weekTravel(currentDays, base),
    proposedTravel: weekTravel(finalDays, base),
  };
}
