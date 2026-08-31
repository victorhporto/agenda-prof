import { describe, expect, it } from "vitest";
import { effectiveLocation } from "@/lib/lessons/location";

describe("effectiveLocation", () => {
  it("prefere o local da aula", () => {
    expect(effectiveLocation("online", "casa_aluno")).toBe("online");
  });

  it("cai no padrão do aluno quando a aula não tem local", () => {
    expect(effectiveLocation(null, "casa_aluno")).toBe("casa_aluno");
  });

  it("retorna null se nenhum estiver cadastrado", () => {
    expect(effectiveLocation(null, null)).toBeNull();
  });
});
