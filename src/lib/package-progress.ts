export function getPackageProgress(
  pkg: { total_lessons: number },
  lessons: { status: string }[],
) {
  const completed = lessons.filter((l) => l.status === "completed").length;
  const scheduled = lessons.filter((l) => l.status === "scheduled").length;
  const remaining = Math.max(pkg.total_lessons - completed, 0);
  const canScheduleMore = completed + scheduled < pkg.total_lessons;

  return { completed, scheduled, remaining, canScheduleMore };
}
