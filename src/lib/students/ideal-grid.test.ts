import { describe, expect, it } from "vitest";
import type { OccupiedBlock, Weekday } from "@/lib/assistente/occupancy";
import {
  canPlace,
  firstFreeSlot,
  moveBlock,
  reservationChanges,
  snapMinutes,
} from "@/lib/students/ideal-grid";
import { reservedBlock, studentsOutsideGrid, type GridStudent } from "@/lib/students/reserved";
import { basePlace } from "@/lib/geo/travel";

function block(studentId: string, weekday: Weekday, start: string, n = 0): OccupiedBlock {
  return {
    weekday,
    start,
    end: start,
    occupiesStart: start,
    occupiesEnd: start,
    location: "online",
    studentId,
    studentName: studentId.toUpperCase(),
    packageTitle: "Horário reservado",
    lessonId: `${studentId}-${n}`,
    scheduledAt: "",
    source: "reserva",
  };
}

describe("snapMinutes", () => {
  it("encaixa em blocos de 15 min dentro do dia", () => {
    expect(snapMinutes(607)).toBe(600);
    expect(snapMinutes(608)).toBe(615);
    expect(snapMinutes(-30)).toBe(0);
    expect(snapMinutes(24 * 60)).toBe(23 * 60);
  });
});

describe("canPlace", () => {
  const blocks = [block("a", 1, "10:00"), block("b", 1, "12:00")];
  it("recusa sobrepor outra aula do mesmo dia", () => {
    expect(canPlace(blocks, "a-0", 1, 11 * 60 + 15)).toBe(false);
    expect(canPlace(blocks, "a-0", 1, 11 * 60)).toBe(true);
    expect(canPlace(blocks, "a-0", 2, 12 * 60)).toBe(true);
    expect(canPlace(blocks, "a-0", 1, 10 * 60 + 30)).toBe(true);
  });
});

describe("moveBlock e reservationChanges", () => {
  it("só aponta o aluno que mudou, com a reserva nova completa", () => {
    const original = [
      block("a", 1, "10:00", 0),
      block("a", 3, "10:00", 1),
      block("b", 2, "14:00", 0),
    ];
    const draft = moveBlock(original, "a-1", 4, 15 * 60);
    expect(draft.find((item) => item.lessonId === "a-1")).toMatchObject({
      weekday: 4,
      start: "15:00",
      end: "16:00",
    });
    expect(reservationChanges(original, draft)).toEqual([
      {
        studentId: "a",
        name: "A",
        slots: [
          { weekday: 1, time: "10:00" },
          { weekday: 4, time: "15:00" },
        ],
      },
    ]);
  });

  it("voltar ao horário original não gera alteração", () => {
    const original = [block("a", 1, "10:00")];
    const moved = moveBlock(original, "a-0", 2, 600);
    const back = moveBlock(moved, "a-0", 1, 600);
    expect(reservationChanges(original, back)).toEqual([]);
  });
});

describe("firstFreeSlot", () => {
  const windows = [
    { weekday: 2 as Weekday, start: "10:00", end: "12:00" },
    { weekday: 1 as Weekday, start: "10:00", end: "11:30" },
  ];
  it("pega o primeiro horário livre seguindo os dias da semana", () => {
    expect(firstFreeSlot([], windows)).toEqual({ weekday: 1, time: "10:00" });
    expect(firstFreeSlot([block("a", 1, "10:00")], windows)).toEqual({
      weekday: 2,
      time: "10:00",
    });
    expect(firstFreeSlot([block("a", 1, "10:30")], windows)).toEqual({
      weekday: 2,
      time: "10:00",
    });
  });
  it("devolve null sem espaço no atendimento", () => {
    expect(firstFreeSlot([block("a", 1, "10:00")], [windows[1]!])).toBeNull();
  });
});

describe("alunos fora da grade", () => {
  const student = (id: string, name: string): GridStudent => ({
    id,
    name,
    default_location: "online",
    lat: null,
    lng: null,
    reserved_slots: [],
    hasActivePackage: false,
  });
  it("lista só quem não tem card na grade, em ordem alfabética", () => {
    const students = [student("c", "Zeca"), student("a", "Ana"), student("b", "Bia")];
    expect(studentsOutsideGrid(students, [block("a", 1, "10:00")]).map((s) => s.id)).toEqual([
      "b",
      "c",
    ]);
  });
  it("gera o card de reserva do aluno no horário escolhido", () => {
    const card = reservedBlock(student("b", "Bia"), { weekday: 3, time: "15:00" }, basePlace());
    expect(card).toMatchObject({
      weekday: 3,
      start: "15:00",
      end: "16:00",
      studentId: "b",
      source: "reserva",
      noActivePackage: true,
    });
  });
});
