import { describe, expect, it } from "vitest";
import {
  isPaymentOverdue,
  packageBalance,
  paymentStatusLabel,
  statusLabel,
} from "@/lib/utils";

describe("statusLabel", () => {
  it("traduz status conhecidos", () => {
    expect(statusLabel("scheduled")).toBe("Agendada");
    expect(statusLabel("completed")).toBe("Concluída");
    expect(statusLabel("missed")).toBe("Não dada");
  });

  it("devolve o valor original se desconhecido", () => {
    expect(statusLabel("custom")).toBe("custom");
  });
});

describe("paymentStatusLabel", () => {
  it("traduz status de pagamento", () => {
    expect(paymentStatusLabel("pending")).toBe("Pendente");
    expect(paymentStatusLabel("partial")).toBe("Parcial");
    expect(paymentStatusLabel("paid")).toBe("Pago");
  });
});

describe("packageBalance", () => {
  it("calcula saldo restante", () => {
    expect(
      packageBalance({
        price: 400,
        amount_paid: 150,
        payment_status: "partial",
      }),
    ).toEqual({ price: 400, paid: 150, due: 250 });
  });

  it("trata pacote marcado pago sem amount_paid como quitado", () => {
    expect(
      packageBalance({
        price: 200,
        amount_paid: 0,
        payment_status: "paid",
      }),
    ).toEqual({ price: 200, paid: 200, due: 0 });
  });

  it("due não fica negativo", () => {
    expect(
      packageBalance({
        price: 100,
        amount_paid: 150,
        payment_status: "paid",
      }).due,
    ).toBe(0);
  });
});

describe("isPaymentOverdue", () => {
  it("não é atraso se já está pago", () => {
    expect(isPaymentOverdue("paid", "2020-01-01", "2026-07-30")).toBe(false);
  });

  it("não é atraso sem data prevista", () => {
    expect(isPaymentOverdue("pending", null, "2026-07-30")).toBe(false);
  });

  it("é atraso quando a data prevista já passou", () => {
    expect(isPaymentOverdue("pending", "2026-07-29", "2026-07-30")).toBe(true);
  });

  it("não é atraso no próprio dia previsto", () => {
    expect(isPaymentOverdue("partial", "2026-07-30", "2026-07-30")).toBe(false);
  });
});
