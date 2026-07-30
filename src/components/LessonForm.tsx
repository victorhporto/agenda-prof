"use client";

import { useMemo, useState, useTransition } from "react";
import { createLesson } from "@/lib/packages/actions";
import { toLocalInputValue } from "@/lib/utils";

type PackageOption = {
  id: string;
  title: string;
  studentName: string;
  remainingSlots: number;
};

type Recurrence = "once" | "weekly" | "biweekly";

export function LessonForm({
  packages,
  defaultPackageId,
}: {
  packages: PackageOption[];
  defaultPackageId?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [packageId, setPackageId] = useState(defaultPackageId ?? "");
  const [recurrence, setRecurrence] = useState<Recurrence>("once");
  const defaultDate = (() => {
    const d = new Date();
    d.setMinutes(0, 0, 0);
    d.setHours(d.getHours() + 1);
    return toLocalInputValue(d);
  })();

  const selected = useMemo(
    () => packages.find((p) => p.id === packageId),
    [packages, packageId],
  );
  const remaining = selected?.remainingSlots ?? 0;

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

  const submitLabel =
    recurrence !== "once" && remaining > 1
      ? `Agendar ${remaining} aulas ${recurrence === "weekly" ? "semanais" : "quinzenais"}`
      : "Agendar aula";

  return (
    <form action={onSubmit} className="panel space-y-4 p-5">
      <label className="block text-sm font-medium text-[var(--ink-muted)]">
        Pacote
        <select
          name="package_id"
          required
          value={packageId}
          onChange={(e) => setPackageId(e.target.value)}
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

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-[var(--ink-muted)]">
          Repetição
        </legend>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3">
          <input
            type="radio"
            name="recurrence"
            value="once"
            checked={recurrence === "once"}
            onChange={() => setRecurrence("once")}
            className="mt-1"
          />
          <span>
            <span className="block font-medium text-[var(--ink)]">
              Só esta aula
            </span>
            <span className="text-sm text-[var(--ink-muted)]">
              Agenda apenas a data escolhida.
            </span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3">
          <input
            type="radio"
            name="recurrence"
            value="weekly"
            checked={recurrence === "weekly"}
            onChange={() => setRecurrence("weekly")}
            className="mt-1"
            disabled={remaining <= 1}
          />
          <span>
            <span className="block font-medium text-[var(--ink)]">
              Repetir semanalmente
            </span>
            <span className="text-sm text-[var(--ink-muted)]">
              {remaining > 1
                ? `Preenche as ${remaining} vagas restantes, a cada 7 dias.`
                : "Disponível quando o pacote tiver mais de 1 vaga restante."}
            </span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3">
          <input
            type="radio"
            name="recurrence"
            value="biweekly"
            checked={recurrence === "biweekly"}
            onChange={() => setRecurrence("biweekly")}
            className="mt-1"
            disabled={remaining <= 1}
          />
          <span>
            <span className="block font-medium text-[var(--ink)]">
              Repetir quinzenalmente
            </span>
            <span className="text-sm text-[var(--ink-muted)]">
              {remaining > 1
                ? `Preenche as ${remaining} vagas restantes, a cada 14 dias.`
                : "Disponível quando o pacote tiver mais de 1 vaga restante."}
            </span>
          </span>
        </label>
      </fieldset>

      <label className="block text-sm font-medium text-[var(--ink-muted)]">
        Observações
        <textarea name="notes" rows={2} className="input mt-1" />
      </label>
      {error && (
        <p className="form-error">
          {error}
        </p>
      )}
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "Agendando..." : submitLabel}
      </button>
    </form>
  );
}
