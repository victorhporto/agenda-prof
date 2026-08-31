import type { createClient } from "@/lib/supabase/server";
import {
  buildOccupiedBlocks,
  civilWeekBoundsSaoPaulo,
  formatWeekLabel,
  type OccupiedBlock,
  type ScheduledLessonRow,
} from "@/lib/assistente/occupancy";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

export async function loadWeekOccupiedBlocks(
  supabase: ServerClient,
  teacherId: string,
  now = new Date(),
): Promise<{
  occupied: OccupiedBlock[];
  weekLabel: string;
  startYmd: string;
  endYmd: string;
}> {
  const bounds = civilWeekBoundsSaoPaulo(now);
  const { data, error } = await supabase
    .from("lessons")
    .select(
      `
      id,
      scheduled_at,
      location,
      lesson_packages (
        title,
        students ( name, default_location )
      )
    `,
    )
    .eq("teacher_id", teacherId)
    .eq("status", "scheduled")
    .gte("scheduled_at", bounds.start.toISOString())
    .lte("scheduled_at", bounds.end.toISOString())
    .order("scheduled_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return {
    occupied: buildOccupiedBlocks((data ?? []) as ScheduledLessonRow[]),
    weekLabel: formatWeekLabel(bounds),
    startYmd: bounds.startYmd,
    endYmd: bounds.endYmd,
  };
}
