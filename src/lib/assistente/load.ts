import type { createClient } from "@/lib/supabase/server";
import {
  buildOccupiedBlocks,
  rollingWeekBoundsSaoPaulo,
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
import type { Coordinates } from "@/lib/geo/geocode";
import { basePlace, type Place } from "@/lib/geo/travel";

export type RearrangeContext = {
  weekLabel: string;
  fixed: OccupiedBlock[];
  moving: MovingStudent[];
  plan: RearrangePlan;
  base: Coordinates | null;
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
    return { error: "Não foi possível ler a agenda dos próximos 7 dias" };
  }

  const context = buildRearrangeContext(loaded.occupied, input, loaded.base);
  if (!context.ok) return { error: context.error };

  return {
    data: {
      weekLabel: loaded.weekLabel,
      fixed: context.fixed,
      moving: context.moving,
      plan: solveRearrangement(context.moving, context.fixed, loaded.base),
      base: loaded.base.coords,
    },
  };
}

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/** Aulas já dadas ou faltadas continuam mostrando a grade da semana. */
const GRID_LESSON_STATUSES = ["scheduled", "completed", "missed"];

export async function loadTeacherBase(
  supabase: ServerClient,
  teacherId: string,
): Promise<Place> {
  const { data } = await supabase
    .from("profiles")
    .select("base_lat, base_lng")
    .eq("id", teacherId)
    .maybeSingle();
  return basePlace(
    data?.base_lat != null && data?.base_lng != null
      ? { lat: data.base_lat, lng: data.base_lng }
      : null,
  );
}

export async function loadWeekOccupiedBlocks(
  supabase: ServerClient,
  teacherId: string,
  now = new Date(),
): Promise<{
  occupied: OccupiedBlock[];
  base: Place;
  weekLabel: string;
  startYmd: string;
  endYmd: string;
}> {
  const bounds = rollingWeekBoundsSaoPaulo(now);
  const [{ data, error }, base] = await Promise.all([
    supabase
      .from("lessons")
      .select(
        `
      id,
      scheduled_at,
      location,
      lesson_packages (
        title,
        students ( id, name, default_location, lat, lng )
      )
    `,
      )
      .eq("teacher_id", teacherId)
      .in("status", GRID_LESSON_STATUSES)
      .gte("scheduled_at", bounds.start.toISOString())
      .lte("scheduled_at", bounds.end.toISOString())
      .order("scheduled_at", { ascending: true }),
    loadTeacherBase(supabase, teacherId),
  ]);

  if (error) {
    throw new Error(error.message);
  }

  return {
    occupied: buildOccupiedBlocks((data ?? []) as ScheduledLessonRow[], base),
    base,
    weekLabel: formatWeekLabel(bounds),
    startYmd: bounds.startYmd,
    endYmd: bounds.endYmd,
  };
}
