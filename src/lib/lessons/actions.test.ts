import { describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "@/test/supabase-mock";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

describe("completeLesson (orquestração)", () => {
  it("recusa aula que não está agendada", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = createSupabaseMock([
      {
        data: {
          id: "lesson-1",
          status: "completed",
          package_id: "pkg-1",
          scheduled_at: "2026-07-15T13:00:00.000Z",
          lesson_packages: {
            id: "pkg-1",
            total_lessons: 8,
            title: "Inglês",
            students: { name: "Maria" },
          },
        },
      },
    ]);
    vi.mocked(createClient).mockResolvedValue(supabase as never);

    const { completeLesson } = await import("@/lib/lessons/actions");
    const result = await completeLesson("lesson-1");

    expect(result).toEqual({
      error: "Só é possível concluir aulas agendadas",
    });
  });

  it("recusa quando o pacote já está completo", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = createSupabaseMock([
      {
        data: {
          id: "lesson-1",
          status: "scheduled",
          package_id: "pkg-1",
          scheduled_at: "2026-07-15T13:00:00.000Z",
          lesson_packages: {
            id: "pkg-1",
            total_lessons: 4,
            title: "Inglês",
            students: { name: "Maria" },
          },
        },
      },
      {
        data: null,
        count: 4,
      },
    ]);
    vi.mocked(createClient).mockResolvedValue(supabase as never);

    const { completeLesson } = await import("@/lib/lessons/actions");
    const result = await completeLesson("lesson-1");

    expect(result.error).toContain("todas as 4 aulas concluídas");
  });
});
