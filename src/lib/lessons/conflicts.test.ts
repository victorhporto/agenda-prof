import { describe, expect, it, vi } from "vitest";
import {
  findScheduleConflict,
  slotsOverlap,
} from "@/lib/lessons/conflicts";

describe("slotsOverlap", () => {
  const hour = 60 * 60 * 1000;
  const t0 = Date.parse("2026-07-15T13:00:00.000Z");

  it("detecta sobreposição parcial", () => {
    expect(slotsOverlap(t0, t0 + 30 * 60 * 1000)).toBe(true);
  });

  it("não conflita quando a próxima começa exatamente 1h depois", () => {
    expect(slotsOverlap(t0, t0 + hour)).toBe(false);
  });

  it("detecta horário idêntico", () => {
    expect(slotsOverlap(t0, t0)).toBe(true);
  });

  it("não conflita com aula bem antes", () => {
    expect(slotsOverlap(t0, t0 - 2 * hour)).toBe(false);
  });
});

describe("findScheduleConflict", () => {
  it("retorna null quando não há aulas próximas", async () => {
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockResolvedValue({ data: [] }),
        neq: vi.fn().mockReturnThis(),
      })),
    };

    const result = await findScheduleConflict(
      supabase as never,
      "teacher-1",
      "2026-07-15T13:00:00.000Z",
    );

    expect(result).toBeNull();
  });

  it("monta mensagem clara quando há conflito", async () => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockResolvedValue({
        data: [
          {
            id: "lesson-2",
            scheduled_at: "2026-07-15T13:30:00.000Z",
            lesson_packages: {
              title: "Pacote Inglês",
              students: { name: "Maria" },
            },
          },
        ],
      }),
      neq: vi.fn().mockReturnThis(),
    };

    const supabase = {
      from: vi.fn(() => chain),
    };

    const result = await findScheduleConflict(
      supabase as never,
      "teacher-1",
      "2026-07-15T13:00:00.000Z",
    );

    expect(result?.lessonId).toBe("lesson-2");
    expect(result?.message).toContain("Maria");
    expect(result?.message).toContain("Pacote Inglês");
    expect(result?.message).toContain("Conflito de horário");
  });
});
