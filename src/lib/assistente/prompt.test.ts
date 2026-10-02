import { describe, expect, it } from "vitest";
import {
  defaultTeacherWindows,
  findCandidateSlots,
} from "@/lib/assistente/occupancy";
import {
  buildRearrangePrompt,
  buildSystemPrompt,
  parseChatTurns,
} from "@/lib/assistente/prompt";
import {
  buildRearrangeContext,
  solveRearrangement,
} from "@/lib/assistente/rearrange";
import { basePlace, studentPlace } from "@/lib/geo/travel";

const VILA_MAZZEI = { lat: -23.4796813, lng: -46.6029076 };
const TRAMWAY = { lat: -23.4834798, lng: -46.6099892 };
const CONCEICAO = { lat: -23.5001193, lng: -46.6107279 };

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
          travelBefore: { minutes: 60, km: null },
          travelAfter: { minutes: 60, km: null },
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
    expect(prompt).toContain(
      "ocupa 13:00–16:00 com deslocamento antes ~60 min (sem endereço)",
    );
    expect(prompt).toContain("estimativa padrão de 1h");
    expect(prompt).toContain("ainda não cadastrou o ponto de partida");
    expect(prompt).toContain("Não afirme que gravou");
  });
});

describe("buildRearrangePrompt", () => {
  it("passa distâncias e deslocamento semanal, sem endereços", () => {
    const base = basePlace(VILA_MAZZEI);
    const occupied = [
      {
        weekday: 2 as const,
        start: "14:00",
        end: "15:00",
        occupiesStart: "14:00",
        occupiesEnd: "15:00",
        location: "casa_aluno" as const,
        studentId: "t",
        studentName: "Teste 1",
        packageTitle: "Pacote",
        lessonId: "l1",
        scheduledAt: "2026-07-14T17:00:00.000Z",
        place: studentPlace("t", TRAMWAY),
      },
      {
        weekday: 3 as const,
        start: "10:00",
        end: "11:00",
        occupiesStart: "10:00",
        occupiesEnd: "11:00",
        location: "casa_aluno" as const,
        studentId: "c",
        studentName: "Teste 2",
        packageTitle: "Pacote",
        lessonId: "l2",
        scheduledAt: "2026-07-15T13:00:00.000Z",
        place: studentPlace("c", CONCEICAO),
      },
    ];
    const input = {
      students: [
        { studentId: "c", studentSlots: [{ weekday: 2 as const, time: "16:00" }] },
      ],
      teacherWindows: defaultTeacherWindows(),
    };
    const context = buildRearrangeContext(occupied, input, base);
    if (!context.ok) throw new Error(context.error);
    const prompt = buildRearrangePrompt({
      teacherWindows: input.teacherWindows,
      fixed: context.fixed,
      moving: context.moving,
      plan: solveRearrangement(context.moving, context.fixed, base),
      weekLabel: "13/07 a 19/07/2026",
      base: VILA_MAZZEI,
    });

    expect(prompt).toContain("- Teste 2: base do professor 3,4 km, Teste 1 2,6 km");
    expect(prompt).toContain("Deslocamento semanal estimado: atual");
    expect(prompt).toContain("deslocamento antes ~15 min (2,6 km)");
    expect(prompt).not.toMatch(/Rua|Avenida|-23\.|-46\./);
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
