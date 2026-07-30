"use client";

import { useState, useTransition } from "react";
import {
  markPackagePaid,
  updatePackagePayment,
} from "@/lib/payments/actions";
import {
  formatDateOnly,
  formatMoney,
  isPaymentOverdue,
  paymentStatusLabel,
} from "@/lib/utils";
import { PaymentReminderButton } from "@/components/PaymentReminderButton";

type Props = {
  packageId: string;
  price: number | null;
  paymentStatus: string;
  amountPaid: number;
  paymentNotes: string | null;
  paidAt: string | null;
  paymentDueDate: string | null;
  compact?: boolean;
};

export function PaymentPanel({
  packageId,
  price,
  paymentStatus,
  amountPaid,
  paymentNotes,
  paidAt,
  paymentDueDate,
  compact = false,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState(paymentStatus);
  const [open, setOpen] = useState(!compact);
  const overdue = isPaymentOverdue(paymentStatus, paymentDueDate);
  const dueLabel = formatDateOnly(paymentDueDate);

  function onSave(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await updatePackagePayment(formData);
      if (result.error) setError(result.error);
    });
  }

  function onMarkPaid() {
    setError(null);
    startTransition(async () => {
      const result = await markPackagePaid(packageId);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="panel space-y-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-[var(--ink)]">Pagamento</p>
          <p className="text-sm text-[var(--ink-muted)]">
            Valor do pacote: {formatMoney(price)} ·{" "}
            <span
              className={`badge ${
                paymentStatus === "paid"
                  ? "badge-completed"
                  : paymentStatus === "partial"
                    ? "badge-missed"
                    : "badge-scheduled"
              }`}
            >
              {paymentStatusLabel(paymentStatus)}
            </span>
          </p>
          {dueLabel && (
            <p
              className={`mt-1 text-xs ${
                overdue
                  ? "font-medium text-[var(--danger)]"
                  : "text-[var(--ink-muted)]"
              }`}
            >
              Previsto para {dueLabel}
              {overdue ? " · atrasado" : ""}
            </p>
          )}
          {paidAt && (
            <p className="mt-1 text-xs text-[var(--ink-muted)]">
              Pago em {new Date(paidAt).toLocaleDateString("pt-BR")}
            </p>
          )}
        </div>
        {compact && (
          <button
            type="button"
            className="btn-secondary px-3 py-1.5 text-sm"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "Fechar" : "Editar"}
          </button>
        )}
      </div>

      {paymentStatus !== "paid" && (
        <button
          type="button"
          disabled={pending}
          onClick={onMarkPaid}
          className="btn-primary w-full"
        >
          {pending ? "Salvando..." : "Marcar como pago"}
        </button>
      )}

      <PaymentReminderButton packageId={packageId} />

      {open && (
        <form action={onSave} className="space-y-3 border-t border-[var(--border)] pt-3">
          <input type="hidden" name="package_id" value={packageId} />
          <label className="block text-sm font-medium text-[var(--ink-muted)]">
            Status
            <select
              name="payment_status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="input mt-1"
            >
              <option value="pending">Pendente</option>
              <option value="partial">Parcial</option>
              <option value="paid">Pago</option>
            </select>
          </label>
          <label className="block text-sm font-medium text-[var(--ink-muted)]">
            Data prevista do pagamento
            <input
              name="payment_due_date"
              type="date"
              defaultValue={paymentDueDate?.slice(0, 10) ?? ""}
              className="input mt-1"
            />
          </label>
          <label className="block text-sm font-medium text-[var(--ink-muted)]">
            Valor já pago
            <input
              name="amount_paid"
              type="number"
              min={0}
              step="0.01"
              defaultValue={amountPaid || (paymentStatus === "paid" ? price ?? 0 : 0)}
              className="input mt-1"
            />
          </label>
          <label className="block text-sm font-medium text-[var(--ink-muted)]">
            Observações
            <textarea
              name="payment_notes"
              rows={2}
              defaultValue={paymentNotes ?? ""}
              placeholder="Pix, dinheiro, parcela..."
              className="input mt-1"
            />
          </label>
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          <button type="submit" disabled={pending} className="btn-secondary w-full">
            {pending ? "Salvando..." : "Salvar pagamento"}
          </button>
        </form>
      )}
    </div>
  );
}
