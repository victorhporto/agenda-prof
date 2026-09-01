import { describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "@/test/supabase-mock";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

describe("createWaitlistEntry", () => {
  it("recusa nome, contato, local ou horário faltando", async () => {
    const { createWaitlistEntry } = await import("@/lib/waitlist/actions");

    expect(
      await createWaitlistEntry({
        name: "  ",
        contact: "11999999999",
        location: "online",
        slots: [{ weekday: 1, time: "10:00" }],
      }),
    ).toEqual({ error: "Nome é obrigatório" });

    expect(
      await createWaitlistEntry({
        name: "Ana",
        contact: " ",
        location: "online",
        slots: [{ weekday: 1, time: "10:00" }],
      }),
    ).toEqual({ error: "Informe um contato" });

    expect(
      await createWaitlistEntry({
        name: "Ana",
        contact: "11999999999",
        location: "outro",
        slots: [{ weekday: 1, time: "10:00" }],
      }),
    ).toEqual({ error: "Selecione a preferência de local" });

    expect(
      await createWaitlistEntry({
        name: "Ana",
        contact: "11999999999",
        location: "casa_aluno",
        slots: [],
      }),
    ).toEqual({ error: "Informe pelo menos um horário do aluno" });
  });

  it("grava o aluno na fila com o professor logado", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = createSupabaseMock([{ data: null, error: null }]);
    vi.mocked(createClient).mockResolvedValue(supabase as never);

    const { createWaitlistEntry } = await import("@/lib/waitlist/actions");
    const result = await createWaitlistEntry({
      name: "  Carla  ",
      contact: "11988887777",
      location: "casa_professor",
      slots: [{ weekday: "2", time: "14:00:00" }],
    });

    expect(result).toEqual({ success: true });
    expect(supabase.from).toHaveBeenCalledWith("waitlist_entries");
  });
});
