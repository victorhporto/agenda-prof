import { describe, expect, it } from "vitest";
import {
  buildWeekFreeHours,
  formatMinutesLabel,
  segmentOutsideWorkWindows,
  travelLabel,
  weekFreeMinutes,
} from "@/lib/assistente/free-hours";
import {
  defaultTeacherWindows,
  type OccupiedBlock,
} from "@/lib/assistente/occupancy";

const teacherWindows = defaultTeacherWindows();

function lesson(partial: Partial<OccupiedBlock> & Pick<OccupiedBlock, "weekday" | "start" | "end">): OccupiedBlock {
  return {
    occupiesStart: partial.occupiesStart ?? partial.start,
    occupiesEnd: partial.occupiesEnd ?? partial.end,
    location: partial.location ?? null,
    studentName: partial.studentName ?? "Ana",
    packageTitle: partial.packageTitle ?? "Pacote 4",
    lessonId: partial.lessonId ?? "lesson-1",
    scheduledAt: partial.scheduledAt ?? "2026-07-14T17:00:00.000Z",
    ...partial,
  };
}

describe("buildWeekFreeHours", () => {
  it("marca a janela inteira como livre quando não há aulas", () => {
    const days = buildWeekFreeHours({ teacherWindows, occupied: [] });
    expect(days).toHaveLength(5);
    expect(days[0]).toEqual(
      expect.objectContaining({
        weekday: 1,
        freeMinutes: 10 * 60,
        segments: [{ weekday: 1, start: "10:00", end: "20:00", kind: "free" }],
      }),
    );
    expect(weekFreeMinutes(days)).toBe(5 * 10 * 60);
  });

  it("corta um horário livre em volta de aula online", () => {
    const days = buildWeekFreeHours({
      teacherWindows,
      occupied: [
        lesson({
          weekday: 2,
          start: "14:00",
          end: "15:00",
        }),
      ],
    });
    const tuesday = days.find((day) => day.weekday === 2);
    expect(tuesday?.segments).toEqual([
      { weekday: 2, start: "10:00", end: "14:00", kind: "free" },
      expect.objectContaining({
        kind: "lesson",
        start: "14:00",
        end: "15:00",
        studentName: "Ana",
      }),
      { weekday: 2, start: "15:00", end: "20:00", kind: "free" },
    ]);
    expect(tuesday?.freeMinutes).toBe(9 * 60);
  });

  it("mostra locomoção 1h antes e 1h depois de aula na casa do aluno", () => {
    const days = buildWeekFreeHours({
      teacherWindows,
      occupied: [
        lesson({
          weekday: 2,
          start: "14:00",
          end: "15:00",
          occupiesStart: "13:00",
          occupiesEnd: "16:00",
          location: "casa_aluno",
        }),
      ],
    });
    const tuesday = days.find((day) => day.weekday === 2);
    expect(tuesday?.segments).toEqual([
      { weekday: 2, start: "10:00", end: "13:00", kind: "free" },
      expect.objectContaining({
        kind: "travel",
        start: "13:00",
        end: "14:00",
        travelSide: "before",
        studentName: "Ana",
      }),
      expect.objectContaining({
        kind: "lesson",
        start: "14:00",
        end: "15:00",
      }),
      expect.objectContaining({
        kind: "travel",
        start: "15:00",
        end: "16:00",
        travelSide: "after",
      }),
      { weekday: 2, start: "16:00", end: "20:00", kind: "free" },
    ]);
    expect(tuesday?.freeMinutes).toBe(7 * 60);
  });

  it("exibe deslocamento antes da janela do professor", () => {
    const days = buildWeekFreeHours({
      teacherWindows,
      occupied: [
        lesson({
          weekday: 1,
          start: "10:00",
          end: "11:00",
          occupiesStart: "09:00",
          occupiesEnd: "12:00",
          location: "casa_aluno",
        }),
      ],
    });
    const monday = days.find((day) => day.weekday === 1);
    expect(monday?.segments[0]).toEqual(
      expect.objectContaining({
        kind: "travel",
        start: "09:00",
        end: "10:00",
        travelSide: "before",
      }),
    );
    expect(monday?.segments).toEqual(
      expect.arrayContaining([
        { weekday: 1, start: "12:00", end: "20:00", kind: "free" },
      ]),
    );
  });

  it("exibe deslocamento depois do fim da janela", () => {
    const days = buildWeekFreeHours({
      teacherWindows,
      occupied: [
        lesson({
          weekday: 1,
          start: "19:00",
          end: "20:00",
          occupiesStart: "18:00",
          occupiesEnd: "21:00",
          location: "casa_aluno",
        }),
      ],
    });
    const monday = days.find((day) => day.weekday === 1);
    expect(monday?.segments.at(-1)).toEqual(
      expect.objectContaining({
        kind: "travel",
        start: "20:00",
        end: "21:00",
        travelSide: "after",
      }),
    );
    expect(monday?.freeMinutes).toBe(8 * 60);
  });

  it("não conta intervalo entre janelas do mesmo dia como livre", () => {
    const days = buildWeekFreeHours({
      teacherWindows: [
        { weekday: 1, start: "10:00", end: "12:00" },
        { weekday: 1, start: "14:00", end: "18:00" },
      ],
      occupied: [],
    });
    expect(days[0]?.segments).toEqual([
      { weekday: 1, start: "10:00", end: "12:00", kind: "free" },
      { weekday: 1, start: "12:00", end: "14:00", kind: "outside" },
      { weekday: 1, start: "14:00", end: "18:00", kind: "free" },
    ]);
    expect(days[0]?.freeMinutes).toBe(6 * 60);
  });

  it("aula na casa do aluno impede horário livre vizinho mesmo com outra aula online depois", () => {
    const days = buildWeekFreeHours({
      teacherWindows,
      occupied: [
        lesson({
          weekday: 3,
          start: "14:00",
          end: "15:00",
          occupiesStart: "13:00",
          occupiesEnd: "16:00",
          location: "casa_aluno",
          lessonId: "a",
        }),
        lesson({
          weekday: 3,
          start: "16:00",
          end: "17:00",
          lessonId: "b",
          studentName: "Bruno",
          location: "online",
        }),
      ],
    });
    const wednesday = days.find((day) => day.weekday === 3);
    expect(wednesday?.segments.map((segment) => `${segment.kind}:${segment.start}-${segment.end}`)).toEqual(
      [
        "free:10:00-13:00",
        "travel:13:00-14:00",
        "lesson:14:00-15:00",
        "travel:15:00-16:00",
        "lesson:16:00-17:00",
        "free:17:00-20:00",
      ],
    );
  });

  it("mostra aula em dia sem atendimento, sem inventar horário livre", () => {
    const days = buildWeekFreeHours({
      teacherWindows,
      occupied: [
        lesson({
          weekday: 6,
          start: "10:00",
          end: "11:00",
          location: "online",
        }),
      ],
    });
    const saturday = days.find((day) => day.weekday === 6);
    expect(saturday?.windows).toEqual([]);
    expect(saturday?.freeMinutes).toBe(0);
    expect(saturday?.segments).toEqual([
      expect.objectContaining({ kind: "lesson", start: "10:00", end: "11:00" }),
    ]);
  });

  it("mostra o intervalo até uma aula depois do fim do atendimento", () => {
    const days = buildWeekFreeHours({
      teacherWindows,
      occupied: [
        lesson({
          weekday: 3,
          start: "22:00",
          end: "23:00",
          studentName: "Teste 3",
          location: "online",
        }),
      ],
    });
    const wednesday = days.find((day) => day.weekday === 3);
    expect(wednesday?.segments.map((segment) => `${segment.kind}:${segment.start}-${segment.end}`)).toEqual(
      ["free:10:00-20:00", "outside:20:00-22:00", "lesson:22:00-23:00"],
    );
    expect(wednesday?.freeMinutes).toBe(10 * 60);
  });

  it("mostra o intervalo entre uma aula cedo e o início do atendimento", () => {
    const days = buildWeekFreeHours({
      teacherWindows,
      occupied: [
        lesson({
          weekday: 1,
          start: "08:00",
          end: "09:00",
          location: "online",
        }),
      ],
    });
    const monday = days.find((day) => day.weekday === 1);
    expect(monday?.segments.map((segment) => `${segment.kind}:${segment.start}-${segment.end}`)).toEqual(
      ["lesson:08:00-09:00", "outside:09:00-10:00", "free:10:00-20:00"],
    );
    expect(monday?.freeMinutes).toBe(10 * 60);
  });

  it("mostra locomoção depois do atendimento quando a aula é na casa do aluno", () => {
    const days = buildWeekFreeHours({
      teacherWindows,
      occupied: [
        lesson({
          weekday: 3,
          start: "22:00",
          end: "23:00",
          occupiesStart: "21:00",
          occupiesEnd: "24:00",
          location: "casa_aluno",
        }),
      ],
    });
    const wednesday = days.find((day) => day.weekday === 3);
    expect(wednesday?.segments.map((segment) => `${segment.kind}:${segment.start}-${segment.end}`)).toEqual(
      [
        "free:10:00-20:00",
        "outside:20:00-21:00",
        "travel:21:00-22:00",
        "lesson:22:00-23:00",
        "travel:23:00-24:00",
      ],
    );
    expect(wednesday?.freeMinutes).toBe(10 * 60);
  });
});

describe("segmentOutsideWorkWindows", () => {
  it("marca aula depois do fim do atendimento", () => {
    expect(
      segmentOutsideWorkWindows(
        { weekday: 3, start: "22:00", end: "23:00", kind: "lesson" },
        [{ start: "10:00", end: "20:00" }],
      ),
    ).toBe(true);
    expect(
      segmentOutsideWorkWindows(
        { weekday: 3, start: "14:00", end: "15:00", kind: "lesson" },
        [{ start: "10:00", end: "20:00" }],
      ),
    ).toBe(false);
  });
});
describe("formatMinutesLabel", () => {
  it("formata horas e minutos", () => {
    expect(formatMinutesLabel(0)).toBe("0h");
    expect(formatMinutesLabel(60)).toBe("1h");
    expect(formatMinutesLabel(90)).toBe("1h30");
    expect(formatMinutesLabel(45)).toBe("45 min");
  });
});

describe("travelLabel", () => {
  it("distingue ida e volta", () => {
    expect(
      travelLabel({
        weekday: 1,
        start: "13:00",
        end: "14:00",
        kind: "travel",
        studentName: "Ana",
        travelSide: "before",
      }),
    ).toBe("Deslocamento até Ana");
    expect(
      travelLabel({
        weekday: 1,
        start: "15:00",
        end: "16:00",
        kind: "travel",
        studentName: "Ana",
        travelSide: "after",
      }),
    ).toBe("Deslocamento após Ana");
  });
});
