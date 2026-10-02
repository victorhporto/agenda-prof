import type { createClient } from "@/lib/supabase/server";
import {
  buildOccupiedBlocks,
  civilWeekBoundsSaoPaulo,
  formatWeekLabel,
  type OccupiedBlock,
  type ScheduledLessonRow,
} from "@/lib/assistente/occupancy";
import {
  buildRearrangeContext,
  solveRearrangement,
  type MovingStudent,
  type RearrangeInput,
  type RearrangePlan,
} from "@/lib/assistente/rearrange";

export type RearrangeContext = {
  weekLabel: string;
  fixed: OccupiedBlock[];
  moving: MovingStudent[];
  plan: RearrangePlan;
};

export async function loadRearrangeContext(
  supabase: ServerClient,
  teacherId: string,
  input: RearrangeInput,
): Promise<{ data: RearrangeContext } | { error: string }> {
  let loaded: Awaited<ReturnType<typeof loadWeekOccupiedBlocks>>;
  try {
    loaded = await loadWeekOccupiedBlocks(supabase, teacherId);
  } catch {
    return { error: "Não foi possível ler a agenda desta semana" };
  }

  const context = buildRearrangeContext(loaded.occupied, input);
  if (!context.ok) return { error: context.error };

  return {
    data: {
      weekLabel: loaded.weekLabel,
      fixed: context.fixed,
      moving: context.moving,
      plan: solveRearrangement(context.moving),
    },
  };
}

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
        students ( id, name, default_location )
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
