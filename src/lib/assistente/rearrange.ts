import {
  findCandidateSlots,
  parseStudentSlots,
  parseTeacherWindows,
  parseTimeToMinutes,
  rangesOverlap,
  type CandidateSlot,
  type OccupiedBlock,
  type StudentSlot,
  type TeacherWindow,
} from "@/lib/assistente/occupancy";
import type { LessonLocation } from "@/lib/lessons/location";

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

export type RearrangePlan = {
  entries: PlanEntry[];
  placedLessons: number;
  totalLessons: number;
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

export function buildRearrangeContext(
  occupied: OccupiedBlock[],
  input: RearrangeInput,
):
  | { ok: true; fixed: OccupiedBlock[]; moving: MovingStudent[] }
  | { ok: false; error: string } {
  const selected = new Set(input.students.map((student) => student.studentId));
  const fixed = occupied.filter(
    (block) => !block.studentId || !selected.has(block.studentId),
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
    const movingStudent: MovingStudent = {
      studentId: student.studentId,
      studentName: current[0]!.studentName,
      location,
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
    }).sort(
      (a, b) =>
        Number(isCurrentSlot(movingStudent, b)) -
        Number(isCurrentSlot(movingStudent, a)),
    );
    moving.push(movingStudent);
  }

  return { ok: true, fixed, moving };
}

type Range = { weekday: number; start: number; end: number };

function slotRange(slot: CandidateSlot): Range | null {
  const start = parseTimeToMinutes(slot.occupiesStart);
  const end = parseTimeToMinutes(slot.occupiesEnd);
  if (start == null || end == null) return null;
  return { weekday: slot.weekday, start, end: end <= start ? 24 * 60 : end };
}

/**
 * Busca exaustiva (com poda e teto de nós) do plano que coloca mais aulas e,
 * empatando, mantém mais aulas no horário atual. Cada aluno no máximo uma
 * aula por dia; as faixas com locomoção não podem se sobrepor entre si.
 */
export function solveRearrangement(moving: MovingStudent[]): RearrangePlan {
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

  const ranges = order.map(({ student }) =>
    student.candidates.map((slot) => slotRange(slot)),
  );
  const kept = order.map(({ student }) =>
    student.candidates.map((slot) => isCurrentSlot(student, slot)),
  );

  const chosen: number[][] = order.map(() => []);
  const skipped = order.map(() => false);
  const active: Range[] = [];
  let best = { placed: -1, kept: -1, picks: order.map(() => [] as number[]) };
  let nodes = 0;

  function conflicts(range: Range, position: number) {
    for (const index of chosen[position]!) {
      if (ranges[position]![index]!.weekday === range.weekday) return true;
    }
    return active.some(
      (other) =>
        other.weekday === range.weekday &&
        rangesOverlap(range.start, range.end, other.start, other.end),
    );
  }

  function search(unit: number, placed: number, keptCount: number) {
    nodes++;
    if (nodes > MAX_SEARCH_NODES) return;
    const remaining = units.length - unit;
    if (placed + remaining < best.placed) return;
    if (placed + remaining === best.placed && keptCount + remaining <= best.kept) {
      return;
    }
    if (unit === units.length) {
      best = {
        placed,
        kept: keptCount,
        picks: chosen.map((picks) => [...picks]),
      };
      return;
    }

    const position = units[unit]!;
    if (!skipped[position]) {
      const picks = chosen[position]!;
      const from = picks.length ? picks[picks.length - 1]! + 1 : 0;
      for (let index = from; index < ranges[position]!.length; index++) {
        const range = ranges[position]![index];
        if (!range || conflicts(range, position)) continue;
        picks.push(index);
        active.push(range);
        search(
          unit + 1,
          placed + 1,
          keptCount + (kept[position]![index] ? 1 : 0),
        );
        active.pop();
        picks.pop();
      }
    }

    const wasSkipped = skipped[position]!;
    skipped[position] = true;
    search(unit + 1, placed, keptCount);
    skipped[position] = wasSkipped;
  }

  search(0, 0, 0);

  const byIndex = new Map<number, PlanEntry>();
  order.forEach(({ student, index }, position) => {
    const slots = (best.picks[position] ?? [])
      .map((pick) => student.candidates[pick]!)
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
  };
}
