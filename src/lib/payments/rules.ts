export type PaymentSyncInput = {
  price: number | null | undefined;
  amountPaid: number;
  existingPaidAt: string | null;
  nowIso?: string;
};

export type PaymentSyncResult = {
  amountPaid: number;
  paymentStatus: "pending" | "partial" | "paid";
  paidAt: string | null;
};

/** Calcula totais/status de pagamento sem tocar no banco. */
export function computePaymentSync(
  input: PaymentSyncInput,
): PaymentSyncResult {
  const amountPaid = Number(input.amountPaid);
  const price = Number(input.price ?? 0);
  const nowIso = input.nowIso ?? new Date().toISOString();

  if (amountPaid <= 0) {
    return { amountPaid, paymentStatus: "pending", paidAt: null };
  }

  if (price > 0 && amountPaid >= price) {
    return {
      amountPaid,
      paymentStatus: "paid",
      paidAt: input.existingPaidAt ?? nowIso,
    };
  }

  if (price <= 0 && amountPaid > 0) {
    return {
      amountPaid,
      paymentStatus: "paid",
      paidAt: input.existingPaidAt ?? nowIso,
    };
  }

  return { amountPaid, paymentStatus: "partial", paidAt: null };
}
