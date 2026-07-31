import type { createClient } from "@/lib/supabase/server";
import { formatInSaoPaulo } from "@/lib/timezone";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

export const DEFAULT_LESSON_DURATION_MS = 60 * 60 * 1000;

/** Duas aulas de 1h se sobrepõem quando os intervalos [start, start+1h) cruzam. */
export function slotsOverlap(
  aStartMs: number,
  bStartMs: number,
  durationMs = DEFAULT_LESSON_DURATION_MS,
) {
  const aEnd = aStartMs + durationMs;
  const bEnd = bStartMs + durationMs;
  return aStartMs < bEnd && bStartMs < aEnd;
}

export async function findScheduleConflict(
  supabase: ServerClient,
  teacherId: string,
  scheduledAtIso: string,
  options?: { excludeLessonId?: string },
) {
  const startMs = new Date(scheduledAtIso).getTime();
  if (!Number.isFinite(startMs)) return null;

  const windowStart = new Date(
    startMs - DEFAULT_LESSON_DURATION_MS,
  ).toISOString();
  const windowEnd = new Date(
    startMs + DEFAULT_LESSON_DURATION_MS,
  ).toISOString();

  let query = supabase
    .from("lessons")
    .select(
      `
      id,
      scheduled_at,
      lesson_packages (
        title,
        students ( name )
      )
    `,
    )
    .eq("teacher_id", teacherId)
    .eq("status", "scheduled")
    .gte("scheduled_at", windowStart)
    .lte("scheduled_at", windowEnd);

  if (options?.excludeLessonId) {
    query = query.neq("id", options.excludeLessonId);
  }

  const { data } = await query;
  const conflict = (data ?? []).find((lesson) =>
    slotsOverlap(startMs, new Date(lesson.scheduled_at).getTime()),
  );

  if (!conflict) return null;

  const pkg = conflict.lesson_packages as {
    title: string;
    students: { name: string } | null;
  } | null;
  const studentName = pkg?.students?.name ?? "outro aluno";
  const when = formatInSaoPaulo(conflict.scheduled_at, "dd/MM 'às' HH:mm");

  return {
    lessonId: conflict.id,
    message: `Conflito de horário com ${studentName} (${pkg?.title ?? "pacote"}) em ${when}. Escolha outro horário.`,
  };
}

export async function findScheduleConflicts(
  supabase: ServerClient,
  teacherId: string,
  scheduledAtIsos: string[],
  options?: { excludeLessonId?: string },
) {
  for (const iso of scheduledAtIsos) {
    const conflict = await findScheduleConflict(
      supabase,
      teacherId,
      iso,
      options,
    );
    if (conflict) return conflict;
  }
  return null;
}
