"use client";

import { useMemo, useState, useTransition } from "react";
import { createPackage } from "@/lib/packages/actions";

type StudentOption = { id: string; name: string };

export function PackageForm({ students }: { students: StudentOption[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [price, setPrice] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("pending");
  const [paymentDueDate, setPaymentDueDate] = useState("");

  const warnings = useMemo(() => {
    const list: string[] = [];
    const hasPrice = price.trim() !== "" && Number(price) > 0;

    if (!hasPrice) {
      list.push(
        "Sem valor do pacote, o faturamento não consegue calcular vendido/a receber.",
      );
    }
    if (paymentStatus !== "paid" && !paymentDueDate) {
      list.push(
        "Sem data prevista, fica mais difícil acompanhar atrasos no financeiro.",
      );
    }
    return list;
  }, [price, paymentStatus, paymentDueDate]);

  function onSubmit(formData: FormData) {
    setError(null);

    if (warnings.length > 0) {
      const ok = confirm(
        `Atenção:\n\n- ${warnings.join("\n- ")}\n\nDeseja criar o pacote mesmo assim?`,
      );
      if (!ok) return;
    }

    startTransition(async () => {
      const result = await createPackage(formData);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form action={onSubmit} className="panel space-y-4 p-5">
      <label className="block text-sm font-medium text-[var(--ink-muted)]">
        Aluno
        <select name="student_id" required className="input mt-1">
          <option value="">Selecione...</option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-medium text-[var(--ink-muted)]">
        Título
        <input
          name="title"
          required
          placeholder="Ex.: Pacote de 4 aulas"
          className="input mt-1"
        />
      </label>
      <label className="block text-sm font-medium text-[var(--ink-muted)]">
        Total de aulas
        <input
          name="total_lessons"
          type="number"
          min={1}
          defaultValue={4}
          required
          className="input mt-1"
        />
      </label>
      <label className="block text-sm font-medium text-[var(--ink-muted)]">
        Valor
        <input
          name="price"
          type="number"
          min={0}
          step="0.01"
          placeholder="0.00"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="input mt-1"
        />
      </label>
      <label className="block text-sm font-medium text-[var(--ink-muted)]">
        Pagamento
        <select
          name="payment_status"
          value={paymentStatus}
          onChange={(e) => setPaymentStatus(e.target.value)}
          className="input mt-1"
        >
          <option value="pending">Pendente</option>
          <option value="paid">Já pago</option>
        </select>
      </label>
      <label className="block text-sm font-medium text-[var(--ink-muted)]">
        Data prevista do pagamento
        <input
          name="payment_due_date"
          type="date"
          value={paymentDueDate}
          onChange={(e) => setPaymentDueDate(e.target.value)}
          className="input mt-1"
        />
      </label>

      {warnings.length > 0 && (
        <div className="rounded-xl border border-[var(--warning)]/30 bg-[var(--warning-soft)] px-3 py-3 text-sm text-[var(--warning)]">
          <p className="font-semibold">Recomendado revisar:</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <p className="form-error">
          {error}
        </p>
      )}
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "Criando..." : "Criar pacote"}
      </button>
    </form>
  );
}
