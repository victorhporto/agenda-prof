import { describe, expect, it } from "vitest";
import {
  buildOccupiedBlocks,
  civilWeekBoundsSaoPaulo,
  defaultTeacherWindows,
  findCandidateSlots,
  formatWeekLabel,
  occupiesRange,
  parseAssistenteFormInput,
  parseTimeToMinutes,
  type OccupiedBlock,
} from "@/lib/assistente/occupancy";

const occupied14h: OccupiedBlock = {
  weekday: 2,
  start: "14:00",
  end: "15:00",
  occupiesStart: "14:00",
  occupiesEnd: "15:00",
  location: null,
  studentName: "Ana",
  packageTitle: "Pacote 4",
  lessonId: "lesson-1",
  scheduledAt: "2026-07-14T17:00:00.000Z",
};

const teacherWindows = defaultTeacherWindows();

describe("parseTimeToMinutes", () => {
  it("converte HH:mm e ignora segundos", () => {
    expect(parseTimeToMinutes("10:00")).toBe(600);
    expect(parseTimeToMinutes("14:30")).toBe(870);
    expect(parseTimeToMinutes("09:00:00")).toBe(540);
  });

  it("rejeita horário inválido", () => {
    expect(parseTimeToMinutes("25:00")).toBeNull();
    expect(parseTimeToMinutes("abc")).toBeNull();
  });
});

describe("civilWeekBoundsSaoPaulo", () => {
  it("ancora a semana em segunda–domingo no fuso de Brasília", () => {
    // 15/07/2026 10:00 Brasília = quarta-feira
    const bounds = civilWeekBoundsSaoPaulo(
      new Date("2026-07-15T13:00:00.000Z"),
    );
    expect(bounds.startYmd).toBe("2026-07-13");
    expect(bounds.endYmd).toBe("2026-07-19");
    expect(formatWeekLabel(bounds)).toBe("13/07 a 19/07/2026");
  });
});

describe("buildOccupiedBlocks", () => {
  it("projeta aula agendada para dia da semana e hora de Brasília", () => {
    const blocks = buildOccupiedBlocks([
      {
        id: "lesson-1",
        scheduled_at: "2026-07-14T17:00:00.000Z",
        lesson_packages: {
          title: "Pacote 4",
          students: { name: "Ana" },
        },
      },
    ]);

    expect(blocks).toEqual([
      expect.objectContaining({
        weekday: 2,
        start: "14:00",
        end: "15:00",
        occupiesStart: "14:00",
        occupiesEnd: "15:00",
        location: null,
        studentName: "Ana",
        packageTitle: "Pacote 4",
      }),
    ]);
  });

  it("expande locomoção quando a aula cadastrada é na casa do aluno", () => {
    const blocks = buildOccupiedBlocks([
      {
        id: "lesson-2",
        scheduled_at: "2026-07-14T17:00:00.000Z",
        location: "casa_aluno",
        lesson_packages: {
          title: "Pacote 4",
          students: { name: "Ana" },
        },
      },
    ]);

    expect(blocks).toEqual([
      expect.objectContaining({
        weekday: 2,
        start: "14:00",
        end: "15:00",
        occupiesStart: "13:00",
        occupiesEnd: "16:00",
        location: "casa_aluno",
      }),
    ]);
  });
});

describe("occupiesRange", () => {
  it("reserva 1h antes e depois quando a aula é na casa do aluno", () => {
    expect(occupiesRange(14 * 60, "casa_aluno")).toEqual({
      start: 13 * 60,
      end: 16 * 60,
    });
  });

  it("reserva só a hora da aula para os outros locais", () => {
    expect(occupiesRange(14 * 60, "online")).toEqual({
      start: 14 * 60,
      end: 15 * 60,
    });
    expect(occupiesRange(14 * 60, "casa_professor")).toEqual({
      start: 14 * 60,
      end: 15 * 60,
    });
  });
});

describe("findCandidateSlots", () => {
  it("aceita horário livre que bate com aluno e professor", () => {
    const candidates = findCandidateSlots({
      studentSlots: [{ weekday: 1, time: "11:00" }],
      teacherWindows,
      occupied: [occupied14h],
      location: "online",
    });

    expect(candidates).toEqual([
      {
        weekday: 1,
        time: "11:00",
        occupiesStart: "11:00",
        occupiesEnd: "12:00",
      },
    ]);
  });

  it("rejeita horário já ocupado", () => {
    const candidates = findCandidateSlots({
      studentSlots: [{ weekday: 2, time: "14:00" }],
      teacherWindows,
      occupied: [occupied14h],
      location: "online",
    });
    expect(candidates).toEqual([]);
  });

  it("aplica buffer de locomoção: aula às 14h impede candidato às 15h na casa do aluno", () => {
    const blocked = findCandidateSlots({
      studentSlots: [{ weekday: 2, time: "15:00" }],
      teacherWindows,
      occupied: [occupied14h],
      location: "casa_aluno",
    });
    expect(blocked).toEqual([]);

    const onlineOk = findCandidateSlots({
      studentSlots: [{ weekday: 2, time: "15:00" }],
      teacherWindows,
      occupied: [occupied14h],
      location: "online",
    });
    expect(onlineOk).toHaveLength(1);
    expect(onlineOk[0]?.time).toBe("15:00");
  });

  it("aula cadastrada na casa do aluno às 14h impede candidato às 15h mesmo online", () => {
    const occupiedCasa: OccupiedBlock = {
      ...occupied14h,
      occupiesStart: "13:00",
      occupiesEnd: "16:00",
      location: "casa_aluno",
    };
    const blocked = findCandidateSlots({
      studentSlots: [{ weekday: 2, time: "15:00" }],
      teacherWindows,
      occupied: [occupiedCasa],
      location: "online",
    });
    expect(blocked).toEqual([]);

    const stillOk = findCandidateSlots({
      studentSlots: [{ weekday: 2, time: "16:00" }],
      teacherWindows,
      occupied: [occupiedCasa],
      location: "online",
    });
    expect(stillOk).toHaveLength(1);
    expect(stillOk[0]?.time).toBe("16:00");
  });

  it("permite aula às 10h na casa do aluno (deslocamento antes da janela 10–20)", () => {
    const candidates = findCandidateSlots({
      studentSlots: [{ weekday: 1, time: "10:00" }],
      teacherWindows,
      occupied: [],
      location: "casa_aluno",
    });
    expect(candidates).toEqual([
      {
        weekday: 1,
        time: "10:00",
        occupiesStart: "09:00",
        occupiesEnd: "12:00",
      },
    ]);
  });

  it("rejeita aula fora da disponibilidade do professor", () => {
    const saturday = findCandidateSlots({
      studentSlots: [{ weekday: 6, time: "10:00" }],
      teacherWindows,
      occupied: [],
      location: "online",
    });
    expect(saturday).toEqual([]);

    const tooLate = findCandidateSlots({
      studentSlots: [{ weekday: 1, time: "20:00" }],
      teacherWindows,
      occupied: [],
      location: "online",
    });
    expect(tooLate).toEqual([]);
  });

  it("remove horários duplicados do aluno", () => {
    const candidates = findCandidateSlots({
      studentSlots: [
        { weekday: 1, time: "11:00" },
        { weekday: 1, time: "11:00:00" },
      ],
      teacherWindows,
      occupied: [],
      location: "online",
    });
    expect(candidates).toHaveLength(1);
  });
});

describe("parseAssistenteFormInput", () => {
  it("aceita payload válido e normaliza horários", () => {
    const parsed = parseAssistenteFormInput({
      studentName: "  Carlos  ",
      lessonsPerWeek: 1,
      location: "casa_aluno",
      studentSlots: [{ weekday: "1", time: "14:00:00" }],
      teacherWindows: defaultTeacherWindows(),
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.studentName).toBe("Carlos");
      expect(parsed.value.studentSlots[0]).toEqual({
        weekday: 1,
        time: "14:00",
      });
    }
  });

  it("exige nome e pelo menos um horário", () => {
    expect(parseAssistenteFormInput({}).ok).toBe(false);
    expect(
      parseAssistenteFormInput({
        studentName: "Ana",
        lessonsPerWeek: 1,
        location: "online",
        studentSlots: [],
        teacherWindows: defaultTeacherWindows(),
      }).ok,
    ).toBe(false);
  });
});
