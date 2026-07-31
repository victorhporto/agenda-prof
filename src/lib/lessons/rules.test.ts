import { describe, expect, it } from "vitest";
import {
  canCompleteLesson,
  canMarkMissed,
  canRescheduleLesson,
  canRevertLessonStatus,
  shouldClosePackageAfterComplete,
  shouldReopenPackageAfterRevert,
} from "@/lib/lessons/rules";

describe("canCompleteLesson", () => {
  it("permite aula agendada com vaga", () => {
    expect(canCompleteLesson("scheduled", 2, 8)).toEqual({ ok: true });
  });

  it("bloqueia status diferente de scheduled", () => {
    expect(canCompleteLesson("completed", 2, 8)).toEqual({
      ok: false,
      error: "Só é possível concluir aulas agendadas",
    });
  });

  it("bloqueia quando o pacote já está completo", () => {
    expect(canCompleteLesson("scheduled", 8, 8).ok).toBe(false);
  });
});

describe("canMarkMissed", () => {
  it("só permite agendada", () => {
    expect(canMarkMissed("scheduled").ok).toBe(true);
    expect(canMarkMissed("missed").ok).toBe(false);
  });
});

describe("canRescheduleLesson", () => {
  it("permite remarcar aula agendada mesmo com pacote encerrado", () => {
    expect(
      canRescheduleLesson({
        lessonStatus: "scheduled",
        packageStatus: "closed",
        totalLessons: 8,
        completed: 7,
        scheduled: 1,
      }).ok,
    ).toBe(true);
  });

  it("bloqueia remarcar falta em pacote encerrado", () => {
    const result = canRescheduleLesson({
      lessonStatus: "missed",
      packageStatus: "closed",
      totalLessons: 8,
      completed: 4,
      scheduled: 0,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Reabra o pacote");
  });

  it("bloqueia remarcar falta sem vaga", () => {
    const result = canRescheduleLesson({
      lessonStatus: "missed",
      packageStatus: "active",
      totalLessons: 4,
      completed: 2,
      scheduled: 2,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Não há vaga");
  });

  it("bloqueia status inválido", () => {
    expect(
      canRescheduleLesson({
        lessonStatus: "completed",
        packageStatus: "active",
        totalLessons: 4,
        completed: 1,
        scheduled: 0,
      }).ok,
    ).toBe(false);
  });
});

describe("canRevertLessonStatus", () => {
  it("permite desfazer OK sem checar vaga extra", () => {
    expect(
      canRevertLessonStatus({
        lessonStatus: "completed",
        totalLessons: 4,
        completed: 4,
        scheduled: 0,
      }).ok,
    ).toBe(true);
  });

  it("bloqueia desfazer falta sem vaga", () => {
    expect(
      canRevertLessonStatus({
        lessonStatus: "missed",
        totalLessons: 3,
        completed: 2,
        scheduled: 1,
      }).ok,
    ).toBe(false);
  });

  it("bloqueia status agendada", () => {
    expect(
      canRevertLessonStatus({
        lessonStatus: "scheduled",
        totalLessons: 3,
        completed: 0,
        scheduled: 1,
      }).ok,
    ).toBe(false);
  });
});

describe("package close/reopen helpers", () => {
  it("fecha pacote na última aula", () => {
    expect(shouldClosePackageAfterComplete(8, 8)).toBe(true);
    expect(shouldClosePackageAfterComplete(7, 8)).toBe(false);
  });

  it("reabre ao desfazer OK de pacote fechado", () => {
    expect(shouldReopenPackageAfterRevert("completed", "closed")).toBe(true);
    expect(shouldReopenPackageAfterRevert("missed", "closed")).toBe(false);
    expect(shouldReopenPackageAfterRevert("completed", "active")).toBe(false);
  });
});
