import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  defaultTeacherWindows,
  occupiesRange,
  minutesToTime,
  parseTimeToMinutes,
  type OccupiedBlock,
  type Weekday,
} from "@/lib/assistente/occupancy";
import {
  buildRearrangeContext,
  parseAvailabilityRanges,
  parseRearrangeInput,
  rangeForLesson,
  slotsFromRanges,
  solveRearrangement,
  type AvailabilityRange,
} from "@/lib/assistente/rearrange";
import type { LessonLocation } from "@/lib/lessons/location";
import { basePlace, studentPlace } from "@/lib/geo/travel";

const teacherWindows = defaultTeacherWindows();
const VILA_MAZZEI = { lat: -23.4796813, lng: -46.6029076 };
const TRAMWAY = { lat: -23.4834798, lng: -46.6099892 };
const CONCEICAO = { lat: -23.5001193, lng: -46.6107279 };
const MASP = { lat: -23.5614961, lng: -46.6559677 };
let base = basePlace();

function block(
  studentId: string,
  weekday: Weekday,
  start: string,
  location: LessonLocation | null = "online",
): OccupiedBlock {
  const minutes = parseTimeToMinutes(start)!;
  const occupies = occupiesRange(minutes, location);
  return {
    weekday,
    start,
    end: minutesToTime(minutes + 60),
    occupiesStart: minutesToTime(occupies.start),
    occupiesEnd: minutesToTime(occupies.end),
    location,
    studentId,
    studentName: studentId.toUpperCase(),
    packageTitle: "Pacote",
    lessonId: `${studentId}-${weekday}-${start}`,
    scheduledAt: "2026-09-01T13:00:00.000Z",
  };
}

function solve(
  occupied: OccupiedBlock[],
  students: {
    studentId: string;
    studentSlots?: { weekday: Weekday; time: string }[];
    ranges?: AvailabilityRange[];
  }[],
) {
  const context = buildRearrangeContext(
    occupied,
    {
      students: students.map((student) => ({
        studentId: student.studentId,
        ranges: student.ranges ?? (student.studentSlots ?? []).map(rangeForLesson),
      })),
      teacherWindows,
    },
    base,
  );
  if (!context.ok) throw new Error(context.error);
  return {
    context,
    plan: solveRearrangement(context.moving, context.fixed, base),
  };
}

function atHome(
  studentId: string,
  weekday: Weekday,
  start: string,
  coords: { lat: number; lng: number },
): OccupiedBlock {
  return {
    ...block(studentId, weekday, start, "casa_aluno"),
    place: studentPlace(studentId, coords),
  };
}

describe("parseRearrangeInput", () => {
  it("exige pelo menos um aluno e horários válidos", () => {
    expect(parseRearrangeInput({ students: [], teacherWindows }).ok).toBe(false);
    expect(
      parseRearrangeInput({
        students: [{ studentId: "a", ranges: [] }],
        teacherWindows,
      }).ok,
    ).toBe(false);
  });

  it("ignora aluno repetido", () => {
    const parsed = parseRearrangeInput({
      students: [
        { studentId: "a", ranges: [{ weekday: 1, start: "10:00", end: "12:00" }] },
        { studentId: "a", ranges: [{ weekday: 2, start: "10:00", end: "12:00" }] },
      ],
      teacherWindows,
    });
    expect(parsed.ok && parsed.value.students).toHaveLength(1);
  });
});

describe("faixas de disponibilidade", () => {
  it("expande a faixa em inícios a cada 15 min em que a aula cabe", () => {
    const slots = slotsFromRanges([
      { weekday: 5, start: "10:00", end: "11:30" },
      { weekday: 1, start: "13:00", end: "14:00" },
    ]);
    expect(slots.map((slot) => `${slot.weekday} ${slot.time}`)).toEqual([
      "5 10:00",
      "5 10:15",
      "5 10:30",
      "1 13:00",
    ]);
  });

  it("valida faixas: fim depois do início e pelo menos 1 hora", () => {
    expect(parseAvailabilityRanges([]).ok).toBe(false);
    expect(
      parseAvailabilityRanges([{ weekday: 5, start: "15:00", end: "10:00" }]).ok,
    ).toBe(false);
    expect(
      parseAvailabilityRanges([{ weekday: 5, start: "10:00", end: "10:45" }]).ok,
    ).toBe(false);
    const parsed = parseAvailabilityRanges([
      { weekday: "5", start: "10:00:00", end: "15:00" },
    ]);
    expect(parsed.ok && parsed.value).toEqual([
      { weekday: 5, start: "10:00", end: "15:00" },
    ]);
  });

  it("a faixa da aula atual equivale ao horário atual", () => {
    expect(rangeForLesson({ weekday: 2, time: "14:00" })).toEqual({
      weekday: 2,
      start: "14:00",
      end: "15:00",
    });
  });
});

describe("buildRearrangeContext", () => {
  it("tira os alunos selecionados da grade fixa", () => {
    const { context } = solve(
      [block("a", 1, "10:00"), block("b", 1, "12:00")],
      [{ studentId: "a", studentSlots: [{ weekday: 1, time: "12:00" }] }],
    );
    expect(context.fixed.map((item) => item.studentId)).toEqual(["b"]);
    expect(context.moving[0]?.candidates).toEqual([]);
  });

  it("tira da grade fixa quem o professor liberou", () => {
    const context = buildRearrangeContext(
      [block("a", 1, "10:00"), block("b", 1, "12:00"), block("c", 2, "12:00")],
      {
        students: [{ studentId: "a", ranges: [rangeForLesson({ weekday: 1, time: "12:00" })] }],
        teacherWindows,
        releasedStudentIds: ["b"],
      },
    );
    if (!context.ok) throw new Error(context.error);
    expect(context.fixed.map((item) => item.studentId)).toEqual(["c"]);
    expect(context.moving[0]?.candidates.map((slot) => slot.time)).toEqual(["12:00"]);
  });

  it("parse ignora liberados que também estão sendo remanejados", () => {
    const parsed = parseRearrangeInput({
      students: [{ studentId: "a", ranges: [{ weekday: 1, start: "10:00", end: "11:00" }] }],
      teacherWindows,
      releasedStudentIds: ["a", "b", "b", 3],
    });
    expect(parsed.ok && parsed.value.releasedStudentIds).toEqual(["b"]);
  });

  it("recusa aluno sem aula na semana", () => {
    const context = buildRearrangeContext([block("a", 1, "10:00")], {
      students: [{ studentId: "x", ranges: [{ weekday: 1, start: "10:00", end: "11:00" }] }],
      teacherWindows,
    });
    expect(context.ok).toBe(false);
  });
});

describe("solveRearrangement", () => {
  it("troca dois alunos de horário entre si", () => {
    const { plan } = solve(
      [block("a", 1, "10:00"), block("b", 1, "11:00")],
      [
        { studentId: "a", studentSlots: [{ weekday: 1, time: "11:00" }] },
        { studentId: "b", studentSlots: [{ weekday: 1, time: "10:00" }] },
      ],
    );
    expect(plan.placedLessons).toBe(2);
    expect(plan.entries.map((entry) => `${entry.studentId}:${entry.slots[0]?.time}`)).toEqual(
      ["a:11:00", "b:10:00"],
    );
  });

  it("prefere manter o horário atual quando possível", () => {
    const { plan } = solve(
      [block("a", 2, "14:00")],
      [
        {
          studentId: "a",
          studentSlots: [
            { weekday: 2, time: "16:00" },
            { weekday: 2, time: "14:00" },
          ],
        },
      ],
    );
    expect(plan.entries[0]?.slots[0]?.time).toBe("14:00");
    expect(plan.entries[0]?.keptCount).toBe(1);
  });

  it("respeita a locomoção entre alunos remanejados", () => {
    const { plan } = solve(
      [block("a", 3, "10:00", "casa_aluno"), block("b", 3, "16:00")],
      [
        {
          studentId: "a",
          studentSlots: [{ weekday: 3, time: "14:00" }],
        },
        {
          studentId: "b",
          studentSlots: [
            { weekday: 3, time: "15:00" },
            { weekday: 3, time: "18:00" },
          ],
        },
      ],
    );
    expect(plan.placedLessons).toBe(2);
    const b = plan.entries.find((entry) => entry.studentId === "b");
    expect(b?.slots[0]?.time).toBe("18:00");
  });

  it("acha um horário livre dentro das faixas (sex 10–15 + seg 13–18)", () => {
    const { plan } = solve(
      [
        block("a", 3, "10:00"),
        block("b", 5, "10:00"),
        block("c", 5, "11:00"),
        block("d", 5, "12:00"),
        block("e", 5, "13:00"),
        block("f", 1, "13:00"),
      ],
      [
        {
          studentId: "a",
          ranges: [
            { weekday: 5, start: "10:00", end: "15:00" },
            { weekday: 1, start: "13:00", end: "18:00" },
          ],
        },
      ],
    );
    expect(plan.placedLessons).toBe(1);
    const slot = plan.entries[0]?.slots[0];
    expect(`${slot?.weekday} ${slot?.time}`).toBe("1 14:00");
  });

  it("coloca no máximo uma aula por dia por aluno e aponta o que falta", () => {
    const { plan } = solve(
      [block("a", 1, "10:00"), block("a", 3, "10:00")],
      [
        {
          studentId: "a",
          studentSlots: [
            { weekday: 1, time: "12:00" },
            { weekday: 1, time: "15:00" },
          ],
        },
      ],
    );
    expect(plan.entries[0]?.slots).toHaveLength(1);
    expect(plan.entries[0]?.missing).toBe(1);
    expect(plan.placedLessons).toBe(1);
    expect(plan.totalLessons).toBe(2);
  });
});

describe("solveRearrangement com endereços", () => {
  beforeEach(() => {
    base = basePlace(VILA_MAZZEI);
  });
  afterEach(() => {
    base = basePlace();
  });

  it("prefere o dia em que já vai a um aluno vizinho", () => {
    const { plan } = solve(
      [atHome("t", 2, "14:00", TRAMWAY), atHome("x", 3, "10:00", CONCEICAO)],
      [
        {
          studentId: "x",
          studentSlots: [
            { weekday: 4, time: "16:00" },
            { weekday: 2, time: "16:00" },
          ],
        },
      ],
    );
    const slot = plan.entries[0]?.slots[0];
    expect(slot?.weekday).toBe(2);
    expect(slot?.travelBefore?.minutes).toBe(15);
    expect(plan.proposedTravel.minutes).toBeLessThan(plan.currentTravel.minutes);
  });

  it("aluno perto cabe com 15 min de intervalo; longe não", () => {
    const { plan } = solve(
      [
        atHome("t", 2, "14:00", TRAMWAY),
        atHome("c", 1, "10:00", CONCEICAO),
        atHome("m", 1, "12:00", MASP),
      ],
      [
        { studentId: "c", studentSlots: [{ weekday: 2, time: "15:15" }] },
        { studentId: "m", studentSlots: [{ weekday: 2, time: "15:15" }] },
      ],
    );
    expect(plan.entries[0]?.slots[0]?.time).toBe("15:15");
    expect(plan.entries[1]?.slots).toHaveLength(0);
  });
});
