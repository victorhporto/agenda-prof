import {
  LESSON_DURATION_MINUTES,
  minutesToTime,
  parseTimeToMinutes,
  type OccupiedBlock,
  type StudentSlot,
  type TeacherWindow,
  type Weekday,
} from "@/lib/assistente/occupancy";

export const GRID_SNAP_MINUTES = 15;
const LAST_START = 24 * 60 - LESSON_DURATION_MINUTES;

export function snapMinutes(minutes: number): number {
  const snapped = Math.round(minutes / GRID_SNAP_MINUTES) * GRID_SNAP_MINUTES;
  return Math.min(Math.max(snapped, 0), LAST_START);
}

/** A aula movida não pode encostar no horário de outra aula do mesmo dia. */
export function canPlace(
  blocks: OccupiedBlock[],
  lessonId: string,
  weekday: Weekday,
  start: number,
): boolean {
  if (start < 0 || start > LAST_START) return false;
  return blocks.every((block) => {
    if (block.lessonId === lessonId || block.weekday !== weekday) return true;
    const other = parseTimeToMinutes(block.start);
    return other == null || Math.abs(other - start) >= LESSON_DURATION_MINUTES;
  });
}

/** Primeiro horário (de 15 em 15 min) dentro do atendimento que não bate com outra aula. */
export function firstFreeSlot(
  blocks: OccupiedBlock[],
  teacherWindows: TeacherWindow[],
): StudentSlot | null {
  const windows = [...teacherWindows].sort(
    (a, b) => a.weekday - b.weekday || a.start.localeCompare(b.start),
  );
  for (const window of windows) {
    const from = parseTimeToMinutes(window.start);
    const to = window.end === "24:00" ? 24 * 60 : parseTimeToMinutes(window.end);
    if (from == null || to == null) continue;
    for (let start = from; start + LESSON_DURATION_MINUTES <= to; start += GRID_SNAP_MINUTES) {
      if (canPlace(blocks, "", window.weekday, start)) {
        return { weekday: window.weekday, time: minutesToTime(start) };
      }
    }
  }
  return null;
}

export function moveBlock(
  blocks: OccupiedBlock[],
  lessonId: string,
  weekday: Weekday,
  start: number,
): OccupiedBlock[] {
  return blocks.map((block) => {
    if (block.lessonId !== lessonId) return block;
    const time = minutesToTime(start);
    const end = minutesToTime(start + LESSON_DURATION_MINUTES);
    return {
      ...block,
      weekday,
      start: time,
      end,
      occupiesStart: time,
      occupiesEnd: end,
    };
  });
}

function slotKeys(blocks: OccupiedBlock[]): string {
  return blocks
    .map((block) => `${block.weekday}-${block.start}`)
    .sort()
    .join("|");
}

export type ReservationChange = {
  studentId: string;
  name: string;
  slots: StudentSlot[];
};

/** Alunos cuja grade mudou: a reserva nova é o conjunto de horários dele na grade. */
export function reservationChanges(
  original: OccupiedBlock[],
  draft: OccupiedBlock[],
): ReservationChange[] {
  const byStudent = (blocks: OccupiedBlock[]) => {
    const map = new Map<string, OccupiedBlock[]>();
    for (const block of blocks) {
      if (!block.studentId) continue;
      const list = map.get(block.studentId) ?? [];
      list.push(block);
      map.set(block.studentId, list);
    }
    return map;
  };
  const before = byStudent(original);
  const after = byStudent(draft);

  const changes: ReservationChange[] = [];
  for (const [studentId, blocks] of after) {
    if (slotKeys(blocks) === slotKeys(before.get(studentId) ?? [])) continue;
    changes.push({
      studentId,
      name: blocks[0]!.studentName,
      slots: blocks
        .map((block) => ({ weekday: block.weekday, time: block.start }))
        .sort((a, b) => a.weekday - b.weekday || a.time.localeCompare(b.time)),
    });
  }
  return changes.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}
