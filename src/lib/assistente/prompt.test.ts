import { describe, expect, it } from "vitest";
import {
  defaultTeacherWindows,
  findCandidateSlots,
} from "@/lib/assistente/occupancy";
import { buildSystemPrompt, parseChatTurns } from "@/lib/assistente/prompt";

describe("buildSystemPrompt", () => {
  it("inclui regras de locomoção, recorte da semana e aviso de não gravar", () => {
    const prompt = buildSystemPrompt({
      form: {
        studentName: "Carlos",
        lessonsPerWeek: 1,
        location: "casa_aluno",
        studentSlots: [{ weekday: 1, time: "10:00" }],
        teacherWindows: defaultTeacherWindows(),
      },
      occupied: [
        {
          weekday: 1,
          start: "14:00",
          end: "15:00",
          occupiesStart: "13:00",
          occupiesEnd: "16:00",
          location: "casa_aluno",
          studentName: "Ana",
          packageTitle: "Pacote 4",
          lessonId: "1",
          scheduledAt: "2026-07-13T17:00:00.000Z",
        },
      ],
      candidates: findCandidateSlots({
        studentSlots: [{ weekday: 1, time: "10:00" }],
        teacherWindows: defaultTeacherWindows(),
        occupied: [],
        location: "casa_aluno",
      }),
      weekLabel: "13/07 a 19/07/2026",
    });

    expect(prompt).toContain("Carlos");
    expect(prompt).toContain("Na casa do aluno");
    expect(prompt).toContain("13/07 a 19/07/2026");
    expect(prompt).toContain("Ana");
    expect(prompt).toContain("ocupa 13:00–16:00 com locomoção");
    expect(prompt).toContain("locomoção");
    expect(prompt).toContain("Não afirme que gravou");
  });
});

describe("parseChatTurns", () => {
  it("mantém só user/assistant e corta conteúdo longo", () => {
    const turns = parseChatTurns([
      { role: "system", content: "ignore" },
      { role: "user", content: "  olá  " },
      { role: "assistant", content: "oi" },
    ]);
    expect(turns).toEqual([
      { role: "user", content: "olá" },
      { role: "assistant", content: "oi" },
    ]);
  });
});
