const REPEATABLE_STATUSES = new Set(["completed", "scheduled", "missed"]);

export type RepeatableLesson = {
  status: string;
  scheduled_at: string;
  location: string | null;
};

/** Aulas que definem a grade a repetir: dadas, ainda agendadas ou faltas (não remarcadas/canceladas). */
export function pickLessonsToRepeat<T extends RepeatableLesson>(
  lessons: T[],
  totalLessons: number,
): T[] {
  const limit = Number.isFinite(totalLessons) ? Math.max(0, totalLessons) : 0;
  return [...lessons]
    .filter((lesson) => REPEATABLE_STATUSES.has(lesson.status))
    .sort(
      (a, b) =>
        new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime(),
    )
    .slice(0, limit);
}

/**
 * Recoloca a série no período seguinte: mesmo dia da semana, horário e espaçamento.
 * Começa depois do fim do pacote original e de “agora”, para não cair no passado.
 */
export function shiftLessonDatesToNextPeriod(
  scheduledAtIsos: string[],
  now = new Date(),
): string[] {
  const times = scheduledAtIsos
    .map((iso) => new Date(iso).getTime())
    .filter((time) => Number.isFinite(time))
    .sort((a, b) => a - b);

  if (times.length === 0) return [];

  const first = times[0];
  const last = times[times.length - 1];
  const after = Math.max(now.getTime(), last);

  const anchor = new Date(first);
  while (anchor.getTime() <= after) {
    anchor.setUTCDate(anchor.getUTCDate() + 7);
  }

  const deltaMs = anchor.getTime() - first;
  return times.map((time) => new Date(time + deltaMs).toISOString());
}

export function buildRepeatedLessonRows(args: {
  teacherId: string;
  packageId: string;
  lessons: RepeatableLesson[];
  totalLessons: number;
  now?: Date;
}) {
  const picked = pickLessonsToRepeat(args.lessons, args.totalLessons);
  const dates = shiftLessonDatesToNextPeriod(
    picked.map((lesson) => lesson.scheduled_at),
    args.now,
  );

  return dates.map((scheduledAt, index) => ({
    teacher_id: args.teacherId,
    package_id: args.packageId,
    scheduled_at: scheduledAt,
    status: "scheduled" as const,
    location: picked[index]?.location ?? null,
    notes: null,
  }));
}
