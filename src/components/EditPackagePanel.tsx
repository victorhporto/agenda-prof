"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updatePackage } from "@/lib/packages/actions";

type Props = {
  packageId: string;
  title: string;
  totalLessons: number;
  price: number | null;
  paymentDueDate: string | null;
  completedCount: number;
  scheduledCount: number;
};

export function EditPackagePanel({
  packageId,
  title,
  totalLessons,
  price,
  paymentDueDate,
  completedCount,
  scheduledCount,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await updatePackage(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        className="btn-secondary"
        disabled={pending}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "Fechar edição" : "Editar pacote"}
      </button>

      {open && (
        <form action={onSubmit} className="panel space-y-4 p-5">
          <input type="hidden" name="package_id" value={packageId} />
          <label className="block text-sm font-medium text-[var(--ink-muted)]">
            Título
            <input
              name="title"
              required
              defaultValue={title}
              className="input mt-1"
            />
          </label>
          <label className="block text-sm font-medium text-[var(--ink-muted)]">
            Total de aulas
            <input
              name="total_lessons"
              type="number"
              min={Math.max(1, completedCount + scheduledCount)}
              defaultValue={totalLessons}
              required
              className="input mt-1"
            />
            <span className="mt-1 block text-xs text-[var(--ink-muted)]">
              Mínimo {completedCount + scheduledCount} (dadas + agendadas)
            </span>
          </label>
          <label className="block text-sm font-medium text-[var(--ink-muted)]">
            Valor
            <input
              name="price"
              type="number"
              min={0}
              step="0.01"
              defaultValue={price ?? ""}
              placeholder="0.00"
              className="input mt-1"
            />
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
          {error && <p className="form-error">{error}</p>}
          <button type="submit" disabled={pending} className="btn-primary w-full">
            {pending ? "Salvando..." : "Salvar pacote"}
          </button>
        </form>
      )}

      {!open && error && <p className="form-error">{error}</p>}
    </div>
  );
}
