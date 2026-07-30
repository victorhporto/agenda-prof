"use client";

import { useState, useTransition } from "react";
import { createStudent } from "@/lib/students/actions";

export function StudentForm() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createStudent(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
    });
  }

  if (!open) {
    return (
      <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
        Novo aluno
      </button>
    );
  }

  return (
    <form action={onSubmit} className="panel space-y-3 p-4">
      <label className="block text-sm font-medium text-[var(--ink-muted)]">
        Nome
        <input name="name" required className="input mt-1" />
      </label>
      <label className="block text-sm font-medium text-[var(--ink-muted)]">
        WhatsApp (DDD + número)
        <input name="phone" className="input mt-1" placeholder="11999999999" />
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
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Salvando..." : "Salvar"}
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => setOpen(false)}
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
