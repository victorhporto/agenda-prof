import { describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "@/test/supabase-mock";
import { syncPackagePaymentTotals } from "@/lib/payments/actions";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("syncPackagePaymentTotals (orquestração)", () => {
  it("persiste o resultado de computePaymentSync", async () => {
    const supabase = createSupabaseMock([
      {
        data: {
          id: "pkg-1",
          price: 400,
          paid_at: "2026-06-01T00:00:00.000Z",
          payment_status: "partial",
        },
      },
      {
        data: [{ amount: 200 }, { amount: 200 }],
      },
      {
        data: null,
        error: null,
      },
    ]);

    const result = await syncPackagePaymentTotals(
      supabase as never,
      "pkg-1",
      "teacher-1",
    );

    expect(result).toEqual({
      success: true,
      amountPaid: 400,
      paymentStatus: "paid",
    });
    expect(supabase.from).toHaveBeenCalledWith("lesson_packages");
    expect(supabase.from).toHaveBeenCalledWith("payment_entries");
  });

  it("retorna erro se o pacote não existe", async () => {
    const supabase = createSupabaseMock([{ data: null }]);

    const result = await syncPackagePaymentTotals(
      supabase as never,
      "missing",
      "teacher-1",
    );

    expect(result).toEqual({ error: "Pacote não encontrado" });
  });
});
