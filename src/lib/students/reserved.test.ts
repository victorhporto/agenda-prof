import { describe, expect, it } from "vitest";
import {
  buildIdealGrid,
  findReservationConflicts,
  parseReservedSlots,
  reservedLessonDates,
  suggestReservedSlots,
  type GridStudent,
} from "@/lib/students/reserved";
import type { ScheduledLessonRow } from "@/lib/assistente/occupancy";

describe("parseReservedSlots", () => {
  it("aceita vazio, JSON e normaliza/ordena", () => {
    expect(parseReservedSlots("")).toEqual({ ok: true, value: [] });
    expect(parseReservedSlots("[]")).toEqual({ ok: true, value: [] });
    expect(
      parseReservedSlots(
        JSON.stringify([
          { weekday: 3, time: "9:00" },
          { weekday: "1", time: "11:00:00" },
          { weekday: 1, time: "11:00" },
        ]),
      ),
    ).toEqual({
      ok: true,
      value: [
        { weekday: 1, time: "11:00" },
        { weekday: 3, time: "09:00" },
      ],
    });
  });

  it("recusa dia/hora inválidos e sobreposição no mesmo dia", () => {
    expect(parseReservedSlots([{ weekday: 8, time: "10:00" }]).ok).toBe(false);
    expect(parseReservedSlots([{ weekday: 1, time: "" }]).ok).toBe(false);
    expect(parseReservedSlots("{x").ok).toBe(false);
    expect(
      parseReservedSlots([
        { weekday: 1, time: "10:00" },
        { weekday: 1, time: "10:30" },
      ]).ok,
    ).toBe(false);
  });
});

describe("findReservationConflicts", () => {
  it("aponta quem já reservou a mesma hora, ignorando o próprio aluno", () => {
    const conflicts = findReservationConflicts(
      [
        { weekday: 1, time: "10:30" },
        { weekday: 2, time: "10:00" },
      ],
      [
        { studentId: "a", name: "Ana", slots: [{ weekday: 1, time: "10:00" }] },
        { studentId: "me", name: "Eu", slots: [{ weekday: 2, time: "10:00" }] },
        { studentId: "b", name: "Bia", slots: [{ weekday: 1, time: "11:30" }] },
      ],
      "me",
    );
    expect(conflicts).toEqual([
      { slot: { weekday: 1, time: "10:30" }, names: ["Ana"] },
    ]);
  });
});

describe("suggestReservedSlots", () => {
  const now = new Date("2026-10-03T15:00:00.000Z");

  it("usa as aulas dos próximos 7 dias", () => {
    expect(
      suggestReservedSlots(
        [
          { scheduled_at: "2026-10-05T14:00:00.000Z", status: "scheduled" },
          { scheduled_at: "2026-10-07T14:00:00.000Z", status: "scheduled" },
          { scheduled_at: "2026-10-12T14:00:00.000Z", status: "scheduled" },
          { scheduled_at: "2026-09-28T17:00:00.000Z", status: "completed" },
        ],
        now,
      ),
    ).toEqual([
      { weekday: 1, time: "11:00" },
      { weekday: 3, time: "11:00" },
    ]);
  });

  it("sem aulas futuras, usa a última semana com aula (horário original)", () => {
    expect(
      suggestReservedSlots(
        [
          { scheduled_at: "2026-09-14T14:00:00.000Z", status: "completed" },
          { scheduled_at: "2026-09-21T14:00:00.000Z", status: "rescheduled" },
          {
            scheduled_at: "2026-09-22T20:00:00.000Z",
            status: "completed",
            rescheduled_from_id: "x",
          },
          { scheduled_at: "2026-09-24T14:00:00.000Z", status: "completed" },
          { scheduled_at: "2026-09-25T14:00:00.000Z", status: "cancelled" },
        ],
        now,
      ),
    ).toEqual([
      { weekday: 1, time: "11:00" },
      { weekday: 4, time: "11:00" },
    ]);
  });

  it("sem aulas, não sugere nada", () => {
    expect(suggestReservedSlots([], now)).toEqual([]);
  });
});

describe("buildIdealGrid", () => {
  const todayStart = new Date("2026-10-03T03:00:00.000Z");
  function student(
    id: string,
    reserved: unknown,
    hasActivePackage = true,
  ): GridStudent {
    return {
      id,
      name: id.toUpperCase(),
      default_location: "online",
      lat: null,
      lng: null,
      reserved_slots: reserved,
      hasActivePackage,
    };
  }
  function lesson(id: string, studentId: string, at: string): ScheduledLessonRow {
    return {
      id,
      scheduled_at: at,
      status: "scheduled",
      location: "online",
      lesson_packages: { title: "P", students: { id: studentId, name: studentId } },
    };
  }

  it("usa a reserva; aula real só para quem não tem reserva", () => {
    const grid = buildIdealGrid({
      students: [
        student("a", [{ weekday: 2, time: "15:00" }]),
        student("b", []),
        student("c", [{ weekday: 4, time: "09:00" }], false),
      ],
      lessons: [
        lesson("a-real", "a", "2026-10-05T14:00:00.000Z"),
        lesson("b-real", "b", "2026-10-06T19:00:00.000Z"),
      ],
      todayStart,
    });
    expect(
      grid.map(
        (block) =>
          `${block.studentId} ${block.weekday} ${block.start} ${block.source ?? "aula"}${block.noActivePackage ? " inativo" : ""}`,
      ),
    ).toEqual([
      "a 2 15:00 reserva",
      "b 2 16:00 aula",
      "c 4 09:00 reserva inativo",
    ]);
  });
});

describe("reservedLessonDates", () => {
  it("distribui as aulas pelos horários reservados em ordem", () => {
    const dates = reservedLessonDates(
      [
        { weekday: 3, time: "11:00" },
        { weekday: 1, time: "11:00" },
      ],
      4,
      new Date("2026-10-03T15:00:00.000Z"),
    );
    expect(dates).toEqual([
      "2026-10-05T14:00:00.000Z",
      "2026-10-07T14:00:00.000Z",
      "2026-10-12T14:00:00.000Z",
      "2026-10-14T14:00:00.000Z",
    ]);
  });

  it("começa depois do instante informado, inclusive no mesmo dia", () => {
    const dates = reservedLessonDates(
      [{ weekday: 1, time: "11:00" }],
      1,
      new Date("2026-10-05T14:00:00.000Z"),
    );
    expect(dates).toEqual(["2026-10-12T14:00:00.000Z"]);
  });

  it("sem reserva, nada", () => {
    expect(reservedLessonDates([], 3, new Date())).toEqual([]);
  });
});
