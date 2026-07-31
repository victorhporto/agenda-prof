import { describe, expect, it } from "vitest";
import {
  completedLessonMessage,
  withSignature,
} from "@/lib/messages/templates";

describe("withSignature", () => {
  it("não altera a mensagem sem assinatura ativa", () => {
    expect(withSignature("Oi", { enabled: false, text: "Prof" })).toBe("Oi");
  });

  it("anexa assinatura quando habilitada", () => {
    expect(withSignature("Oi", { enabled: true, text: "Prof Ana" })).toBe(
      "Oi\n\nProf Ana",
    );
  });
});

describe("completedLessonMessage", () => {
  it("preenche template padrão", () => {
    const message = completedLessonMessage({
      studentName: "João",
      sequenceNumber: 3,
      totalLessons: 8,
      scheduledAt: "2026-07-15T13:00:00.000Z",
      remaining: 5,
    });

    expect(message).toContain("João");
    expect(message).toContain("3");
    expect(message).toContain("8");
    expect(message).toContain("5");
    expect(message).toContain("15/07/2026");
  });

  it("respeita template customizado", () => {
    const message = completedLessonMessage(
      {
        studentName: "João",
        sequenceNumber: 1,
        totalLessons: 4,
        scheduledAt: "2026-07-15T13:00:00.000Z",
        remaining: 3,
      },
      "Aula {n}/{total} de {aluno} ok",
    );

    expect(message).toBe("Aula 1/4 de João ok");
  });
});
