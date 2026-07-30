"use client";

import { useState, useTransition } from "react";
import { createPackage } from "@/lib/packages/actions";

type StudentOption = { id: string; name: string };

export function PackageForm({ students }: { students: StudentOption[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(formData: FormData) {
    setError(null);
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
        Valor (opcional)
        <input
          name="price"
          type="number"
          min={0}
          step="0.01"
          placeholder="0.00"
          className="input mt-1"
        />
      </label>
      <label className="block text-sm font-medium text-[var(--ink-muted)]">
        Pagamento
        <select name="payment_status" defaultValue="pending" className="input mt-1">
          <option value="pending">Pendente</option>
          <option value="paid">Já pago</option>
        </select>
      </label>
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "Criando..." : "Criar pacote"}
      </button>
    </form>
  );
}
