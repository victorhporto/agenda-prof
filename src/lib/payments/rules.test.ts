import { describe, expect, it } from "vitest";
import { computePaymentSync } from "@/lib/payments/rules";

describe("computePaymentSync", () => {
  const now = "2026-07-30T12:00:00.000Z";

  it("fica pending sem pagamentos", () => {
    expect(
      computePaymentSync({
        price: 400,
        amountPaid: 0,
        existingPaidAt: "2026-01-01T00:00:00.000Z",
        nowIso: now,
      }),
    ).toEqual({
      amountPaid: 0,
      paymentStatus: "pending",
      paidAt: null,
    });
  });

  it("fica partial quando pagou parte", () => {
    expect(
      computePaymentSync({
        price: 400,
        amountPaid: 150,
        existingPaidAt: null,
        nowIso: now,
      }),
    ).toEqual({
      amountPaid: 150,
      paymentStatus: "partial",
      paidAt: null,
    });
  });

  it("fica paid e preserva paid_at existente", () => {
    expect(
      computePaymentSync({
        price: 400,
        amountPaid: 400,
        existingPaidAt: "2026-06-01T10:00:00.000Z",
        nowIso: now,
      }),
    ).toEqual({
      amountPaid: 400,
      paymentStatus: "paid",
      paidAt: "2026-06-01T10:00:00.000Z",
    });
  });

  it("fica paid e define paid_at novo quando ainda não havia", () => {
    expect(
      computePaymentSync({
        price: 200,
        amountPaid: 200,
        existingPaidAt: null,
        nowIso: now,
      }),
    ).toEqual({
      amountPaid: 200,
      paymentStatus: "paid",
      paidAt: now,
    });
  });

  it("marca paid para pacote sem preço com algum pagamento", () => {
    expect(
      computePaymentSync({
        price: null,
        amountPaid: 50,
        existingPaidAt: null,
        nowIso: now,
      }).paymentStatus,
    ).toBe("paid");
  });
});
