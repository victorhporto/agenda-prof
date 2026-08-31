import { describe, expect, it } from "vitest";
import {
  buildRepeatedLessonRows,
  pickLessonsToRepeat,
  shiftLessonDatesToNextPeriod,
} from "@/lib/packages/repeat-lessons";

describe("pickLessonsToRepeat", () => {
  it("ignora remarcadas e canceladas, e respeita o total do pacote", () => {
    const picked = pickLessonsToRepeat(
      [
        {
          status: "rescheduled",
          scheduled_at: "2026-08-03T13:00:00.000Z",
          location: "online",
        },
        {
          status: "completed",
          scheduled_at: "2026-08-10T13:00:00.000Z",
          location: "online",
        },
        {
          status: "missed",
          scheduled_at: "2026-08-17T13:00:00.000Z",
          location: "casa_aluno",
        },
        {
          status: "cancelled",
          scheduled_at: "2026-08-24T13:00:00.000Z",
          location: "online",
        },
        {
          status: "scheduled",
          scheduled_at: "2026-08-31T13:00:00.000Z",
          location: "online",
        },
      ],
      2,
    );

    expect(picked.map((lesson) => lesson.scheduled_at)).toEqual([
      "2026-08-10T13:00:00.000Z",
      "2026-08-17T13:00:00.000Z",
    ]);
  });
});

describe("shiftLessonDatesToNextPeriod", () => {
  it("continua semanalmente na semana seguinte ao fim do pacote", () => {
    const shifted = shiftLessonDatesToNextPeriod(
      [
        "2026-08-03T13:00:00.000Z",
        "2026-08-10T13:00:00.000Z",
        "2026-08-17T13:00:00.000Z",
        "2026-08-24T13:00:00.000Z",
      ],
      new Date("2026-08-20T12:00:00.000Z"),
    );

    expect(shifted).toEqual([
      "2026-08-31T13:00:00.000Z",
      "2026-09-07T13:00:00.000Z",
      "2026-09-14T13:00:00.000Z",
      "2026-09-21T13:00:00.000Z",
    ]);
  });

  it("pula para depois de hoje quando o pacote já terminou há tempo", () => {
    const shifted = shiftLessonDatesToNextPeriod(
      [
        "2026-03-02T13:00:00.000Z",
        "2026-03-09T13:00:00.000Z",
        "2026-03-16T13:00:00.000Z",
        "2026-03-23T13:00:00.000Z",
      ],
      new Date("2026-08-31T16:00:00.000Z"),
    );

    expect(shifted).toEqual([
      "2026-09-07T13:00:00.000Z",
      "2026-09-14T13:00:00.000Z",
      "2026-09-21T13:00:00.000Z",
      "2026-09-28T13:00:00.000Z",
    ]);
  });

  it("preserva quinzenal", () => {
    const shifted = shiftLessonDatesToNextPeriod(
      [
        "2026-08-03T13:00:00.000Z",
        "2026-08-17T13:00:00.000Z",
        "2026-08-31T13:00:00.000Z",
        "2026-09-14T13:00:00.000Z",
      ],
      new Date("2026-09-15T12:00:00.000Z"),
    );

    expect(shifted).toEqual([
      "2026-09-21T13:00:00.000Z",
      "2026-10-05T13:00:00.000Z",
      "2026-10-19T13:00:00.000Z",
      "2026-11-02T13:00:00.000Z",
    ]);
  });

  it("preserva dois dias na mesma semana", () => {
    const shifted = shiftLessonDatesToNextPeriod(
      [
        "2026-08-04T13:00:00.000Z",
        "2026-08-06T13:00:00.000Z",
        "2026-08-11T13:00:00.000Z",
        "2026-08-13T13:00:00.000Z",
      ],
      new Date("2026-08-14T12:00:00.000Z"),
    );

    expect(shifted).toEqual([
      "2026-08-18T13:00:00.000Z",
      "2026-08-20T13:00:00.000Z",
      "2026-08-25T13:00:00.000Z",
      "2026-08-27T13:00:00.000Z",
    ]);
  });
});

describe("buildRepeatedLessonRows", () => {
  it("copia o local e agenda todas como scheduled", () => {
    const rows = buildRepeatedLessonRows({
      teacherId: "teacher-1",
      packageId: "pkg-new",
      totalLessons: 4,
      now: new Date("2026-08-25T12:00:00.000Z"),
      lessons: [
        {
          status: "completed",
          scheduled_at: "2026-08-03T13:00:00.000Z",
          location: "casa_aluno",
        },
        {
          status: "completed",
          scheduled_at: "2026-08-10T13:00:00.000Z",
          location: "online",
        },
      ],
    });

    expect(rows).toEqual([
      {
        teacher_id: "teacher-1",
        package_id: "pkg-new",
        scheduled_at: "2026-08-31T13:00:00.000Z",
        status: "scheduled",
        location: "casa_aluno",
        notes: null,
      },
      {
        teacher_id: "teacher-1",
        package_id: "pkg-new",
        scheduled_at: "2026-09-07T13:00:00.000Z",
        status: "scheduled",
        location: "online",
        notes: null,
      },
    ]);
  });
});
