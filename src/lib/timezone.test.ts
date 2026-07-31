import { describe, expect, it } from "vitest";
import {
  formatDateOnlyBr,
  formatInSaoPaulo,
  saoPauloInputToIso,
  toSaoPauloInputValue,
} from "@/lib/timezone";

describe("timezone", () => {
  it("converte datetime-local de Brasília para ISO UTC", () => {
    // 10:00 em São Paulo no horário padrão (UTC-3) = 13:00 UTC
    const iso = saoPauloInputToIso("2026-07-15T10:00");
    expect(iso).toBe("2026-07-15T13:00:00.000Z");
  });

  it("roundtrip input ↔ ISO preserva o horário de Brasília", () => {
    const input = "2026-12-01T14:30";
    const iso = saoPauloInputToIso(input);
    expect(iso).not.toBeNull();
    expect(toSaoPauloInputValue(iso)).toBe(input);
  });

  it("retorna null para valor vazio", () => {
    expect(saoPauloInputToIso("")).toBeNull();
    expect(saoPauloInputToIso("   ")).toBeNull();
  });

  it("formata data pura sem deslocar o dia", () => {
    expect(formatDateOnlyBr("2026-07-30")).toBe("30/07/2026");
    expect(formatDateOnlyBr(null)).toBeNull();
  });

  it("formata instante ISO no fuso de Brasília", () => {
    const label = formatInSaoPaulo("2026-07-15T13:00:00.000Z", "dd/MM HH:mm");
    expect(label).toBe("15/07 10:00");
  });
});
