"use client";

import { useState, useTransition } from "react";
import {
  addPaymentEntry,
  deletePaymentEntry,
  markPackagePaid,
  updatePackagePaymentMeta,
} from "@/lib/payments/actions";
import {
  formatDateOnly,
  formatMoney,
  isPaymentOverdue,
  paymentStatusLabel,
} from "@/lib/utils";
import { PaymentReminderButton } from "@/components/PaymentReminderButton";

type PaymentEntry = {
  id: string;
  amount: number;
  paid_at: string;
  method: string | null;
  notes: string | null;
};

type Props = {
  packageId: string;
  price: number | null;
  paymentStatus: string;
  amountPaid: number;
  paymentNotes: string | null;
  paidAt: string | null;
  paymentDueDate: string | null;
  entries: PaymentEntry[];
};

export function PaymentPanel({
  packageId,
  price,
  paymentStatus,
  amountPaid,
  paymentNotes,
  paidAt,
  paymentDueDate,
  entries,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const overdue = isPaymentOverdue(paymentStatus, paymentDueDate);
  const dueLabel = formatDateOnly(paymentDueDate);
  const remaining = Math.max(Number(price ?? 0) - Number(amountPaid ?? 0), 0);
  const today = new Date().toISOString().slice(0, 10);

  function onSaveMeta(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await updatePackagePaymentMeta(formData);
      if (result.error) setError(result.error);
    });
  }

  function onAddPayment(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await addPaymentEntry(formData);
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

  function onDeleteEntry(entryId: string) {
    if (!confirm("Excluir este registro de pagamento?")) return;
    setError(null);
    startTransition(async () => {
      const result = await deletePaymentEntry(entryId, packageId);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="panel space-y-4 p-4">
      <div>
        <p className="font-semibold text-[var(--ink)]">Pagamento</p>
        <p className="text-sm text-[var(--ink-muted)]">
          Valor do pacote: {formatMoney(price)} · Pago:{" "}
          {formatMoney(amountPaid)} ·{" "}
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
        {remaining > 0 && (
          <p className="mt-1 text-sm text-[var(--warning)]">
            Falta {formatMoney(remaining)}
          </p>
        )}
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
        {paidAt && paymentStatus === "paid" && (
          <p className="mt-1 text-xs text-[var(--ink-muted)]">
            Quitado em {new Date(paidAt).toLocaleDateString("pt-BR")}
          </p>
        )}
      </div>

      {paymentStatus !== "paid" && (
        <button
          type="button"
          disabled={pending}
          onClick={onMarkPaid}
          className="btn-primary w-full"
        >
          {pending ? "Salvando..." : "Quitar pacote"}
        </button>
      )}

      <PaymentReminderButton packageId={packageId} />

      <form
        action={onSaveMeta}
        className="space-y-3 border-t border-[var(--border)] pt-3"
      >
        <input type="hidden" name="package_id" value={packageId} />
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
          Observações gerais
          <textarea
            name="payment_notes"
            rows={2}
            defaultValue={paymentNotes ?? ""}
            placeholder="Acordo, desconto..."
            className="input mt-1"
          />
        </label>
        <button type="submit" disabled={pending} className="btn-secondary w-full">
          {pending ? "Salvando..." : "Salvar datas e observações"}
        </button>
      </form>

      <form
        action={onAddPayment}
        className="space-y-3 border-t border-[var(--border)] pt-3"
      >
        <p className="font-medium text-[var(--ink)]">Registrar pagamento</p>
        <input type="hidden" name="package_id" value={packageId} />
        <label className="block text-sm font-medium text-[var(--ink-muted)]">
          Valor
          <input
            name="amount"
            type="number"
            min={0.01}
            step="0.01"
            required
            defaultValue={remaining > 0 ? remaining : ""}
            className="input mt-1"
          />
        </label>
        <label className="block text-sm font-medium text-[var(--ink-muted)]">
          Data do pagamento
          <input
            name="paid_at"
            type="date"
            required
            defaultValue={today}
            className="input mt-1"
          />
        </label>
        <label className="block text-sm font-medium text-[var(--ink-muted)]">
          Forma
          <select name="method" className="input mt-1" defaultValue="">
            <option value="">Não informar</option>
            <option value="Pix">Pix</option>
            <option value="Dinheiro">Dinheiro</option>
            <option value="Cartão">Cartão</option>
            <option value="Transferência">Transferência</option>
            <option value="Outro">Outro</option>
          </select>
        </label>
        <label className="block text-sm font-medium text-[var(--ink-muted)]">
          Observação do pagamento
          <input name="notes" className="input mt-1" placeholder="Parcela 1/2..." />
        </label>
        <button type="submit" disabled={pending} className="btn-primary w-full">
          {pending ? "Salvando..." : "Adicionar ao histórico"}
        </button>
      </form>

      <div className="border-t border-[var(--border)] pt-3">
        <p className="mb-2 font-medium text-[var(--ink)]">Histórico</p>
        {!entries.length ? (
          <p className="text-sm text-[var(--ink-muted)]">
            Nenhum pagamento registrado ainda.
          </p>
        ) : (
          <ul className="space-y-2">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="flex items-start justify-between gap-3 rounded-xl bg-[var(--bg)] px-3 py-2"
              >
                <div className="text-sm">
                  <p className="font-medium">{formatMoney(entry.amount)}</p>
                  <p className="text-[var(--ink-muted)]">
                    {formatDateOnly(entry.paid_at)}
                    {entry.method ? ` · ${entry.method}` : ""}
                  </p>
                  {entry.notes && (
                    <p className="text-[var(--ink-muted)]">{entry.notes}</p>
                  )}
                </div>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => onDeleteEntry(entry.id)}
                  className="text-sm font-medium text-[var(--danger)] hover:underline"
                >
                  Excluir
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && (
        <p className="form-error">
          {error}
        </p>
      )}
    </div>
  );
}
