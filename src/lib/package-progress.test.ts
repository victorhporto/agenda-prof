import { describe, expect, it } from "vitest";
import { getPackageProgress } from "@/lib/package-progress";

describe("getPackageProgress", () => {
  it("conta concluídas e agendadas", () => {
    const result = getPackageProgress(
      { total_lessons: 8 },
      [
        { status: "completed" },
        { status: "completed" },
        { status: "scheduled" },
        { status: "missed" },
        { status: "cancelled" },
      ],
    );

    expect(result).toEqual({
      completed: 2,
      scheduled: 1,
      remaining: 6,
      canScheduleMore: true,
    });
  });

  it("bloqueia novos agendamentos quando vagas acabam", () => {
    const result = getPackageProgress(
      { total_lessons: 3 },
      [
        { status: "completed" },
        { status: "scheduled" },
        { status: "scheduled" },
      ],
    );

    expect(result.canScheduleMore).toBe(false);
    expect(result.remaining).toBe(2);
  });

  it("remaining não fica negativo", () => {
    const result = getPackageProgress(
      { total_lessons: 2 },
      [{ status: "completed" }, { status: "completed" }, { status: "completed" }],
    );

    expect(result.remaining).toBe(0);
  });
});
