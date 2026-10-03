import type { createClient } from "@/lib/supabase/server";
import {
  previousWeekBoundsSaoPaulo,
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
import { buildIdealGrid, type GridStudent } from "@/lib/students/reserved";

export type RearrangeContext = {
  weekLabel: string;
  previousWeekLabel: string;
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
      previousWeekLabel: loaded.previousWeekLabel,
      fixed: context.fixed,
      moving: context.moving,
      plan: solveRearrangement(context.moving, context.fixed, loaded.base),
      base: loaded.base.coords,
    },
  };
}

type ServerClient = Awaited<ReturnType<typeof createClient>>;

const GRID_QUERY_STATUSES = ["scheduled", "completed", "missed", "rescheduled"];

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
  previousWeekLabel: string;
  startYmd: string;
  endYmd: string;
}> {
  const bounds = rollingWeekBoundsSaoPaulo(now);
  const previous = previousWeekBoundsSaoPaulo(now);
  const [{ data, error }, { data: students, error: studentsError }, base] = await Promise.all([
    supabase
      .from("lessons")
      .select(
        `
      id,
      scheduled_at,
      location,
      status,
      rescheduled_from_id,
      lesson_packages (
        title,
        students ( id, name, default_location, lat, lng )
      )
    `,
      )
      .eq("teacher_id", teacherId)
      .in("status", GRID_QUERY_STATUSES)
      .gte("scheduled_at", previous.start.toISOString())
      .lte("scheduled_at", bounds.end.toISOString())
      .order("scheduled_at", { ascending: true }),
    supabase
      .from("students")
      .select(
        "id, name, default_location, lat, lng, reserved_slots, lesson_packages ( status )",
      )
      .eq("teacher_id", teacherId),
    loadTeacherBase(supabase, teacherId),
  ]);

  if (error || studentsError) {
    throw new Error((error ?? studentsError)!.message);
  }

  const gridStudents: GridStudent[] = (students ?? []).map((student) => ({
    id: student.id,
    name: student.name,
    default_location: student.default_location,
    lat: student.lat,
    lng: student.lng,
    reserved_slots: student.reserved_slots,
    hasActivePackage: (student.lesson_packages ?? []).some(
      (pkg) => pkg.status === "active",
    ),
  }));

  return {
    occupied: buildIdealGrid({
      students: gridStudents,
      lessons: (data ?? []) as ScheduledLessonRow[],
      todayStart: bounds.start,
      base,
    }),
    base,
    weekLabel: formatWeekLabel(bounds),
    previousWeekLabel: formatWeekLabel(previous),
    startYmd: bounds.startYmd,
    endYmd: bounds.endYmd,
  };
}
