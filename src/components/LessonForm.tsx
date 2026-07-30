"use client";

import { useState, useTransition } from "react";
import { createLesson } from "@/lib/packages/actions";
import { toLocalInputValue } from "@/lib/utils";

type PackageOption = {
  id: string;
  title: string;
  studentName: string;
  remainingSlots: number;
};

export function LessonForm({
  packages,
  defaultPackageId,
}: {
  packages: PackageOption[];
  defaultPackageId?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const defaultDate = (() => {
    const d = new Date();
    d.setMinutes(0, 0, 0);
    d.setHours(d.getHours() + 1);
    return toLocalInputValue(d);
  })();

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createLesson(formData);
      if (result?.error) setError(result.error);
    });
  }

  if (!packages.length) {
    return (
      <div className="panel p-6">
        <p className="font-medium">Nenhum pacote com vagas</p>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          Crie um pacote ou conclua/remarque aulas existentes para liberar
          saldo.
        </p>
      </div>
    );
  }

  return (
    <form action={onSubmit} className="panel space-y-4 p-5">
      <label className="block text-sm font-medium text-[var(--ink-muted)]">
        Pacote
        <select
          name="package_id"
          required
          defaultValue={defaultPackageId ?? ""}
          className="input mt-1"
        >
          <option value="">Selecione...</option>
          {packages.map((p) => (
            <option key={p.id} value={p.id}>
              {p.studentName} — {p.title} ({p.remainingSlots} vaga
              {p.remainingSlots === 1 ? "" : "s"})
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-medium text-[var(--ink-muted)]">
        Data e horário
        <input
          name="scheduled_at"
          type="datetime-local"
          required
          defaultValue={defaultDate}
          className="input mt-1"
        />
      </label>
      <label className="block text-sm font-medium text-[var(--ink-muted)]">
        Observações
        <textarea name="notes" rows={2} className="input mt-1" />
      </label>
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "Agendando..." : "Agendar aula"}
      </button>
    </form>
  );
}
