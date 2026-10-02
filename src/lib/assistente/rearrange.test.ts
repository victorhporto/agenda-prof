import { describe, expect, it } from "vitest";
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
  parseRearrangeInput,
  solveRearrangement,
} from "@/lib/assistente/rearrange";
import type { LessonLocation } from "@/lib/lessons/location";

const teacherWindows = defaultTeacherWindows();

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
  students: { studentId: string; studentSlots: { weekday: Weekday; time: string }[] }[],
) {
  const context = buildRearrangeContext(occupied, { students, teacherWindows });
  if (!context.ok) throw new Error(context.error);
  return { context, plan: solveRearrangement(context.moving) };
}

describe("parseRearrangeInput", () => {
  it("exige pelo menos um aluno e horários válidos", () => {
    expect(parseRearrangeInput({ students: [], teacherWindows }).ok).toBe(false);
    expect(
      parseRearrangeInput({
        students: [{ studentId: "a", studentSlots: [] }],
        teacherWindows,
      }).ok,
    ).toBe(false);
  });

  it("ignora aluno repetido", () => {
    const parsed = parseRearrangeInput({
      students: [
        { studentId: "a", studentSlots: [{ weekday: 1, time: "10:00" }] },
        { studentId: "a", studentSlots: [{ weekday: 2, time: "10:00" }] },
      ],
      teacherWindows,
    });
    expect(parsed.ok && parsed.value.students).toHaveLength(1);
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

  it("recusa aluno sem aula na semana", () => {
    const context = buildRearrangeContext([block("a", 1, "10:00")], {
      students: [{ studentId: "x", studentSlots: [{ weekday: 1, time: "10:00" }] }],
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
