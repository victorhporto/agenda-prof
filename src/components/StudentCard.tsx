"use client";

import { useState, useTransition } from "react";
import { updateStudent } from "@/lib/students/actions";
import { DeleteStudentButton } from "@/components/DeleteStudentButton";

type Student = {
  id: string;
  name: string;
  phone: string | null;
  notes: string | null;
};

export function StudentCard({ student }: { student: Student }) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await updateStudent(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setEditing(false);
    });
  }

  if (editing) {
    return (
      <li className="panel space-y-3 p-4">
        <form action={onSubmit} className="space-y-3">
          <input type="hidden" name="id" value={student.id} />
          <label className="block text-sm font-medium text-[var(--ink-muted)]">
            Nome
            <input
              name="name"
              required
              defaultValue={student.name}
              className="input mt-1"
            />
          </label>
          <label className="block text-sm font-medium text-[var(--ink-muted)]">
            WhatsApp (DDD + número)
            <input
              name="phone"
              defaultValue={student.phone ?? ""}
              className="input mt-1"
              placeholder="11999999999"
            />
          </label>
          <label className="block text-sm font-medium text-[var(--ink-muted)]">
            Observações
            <textarea
              name="notes"
              rows={2}
              defaultValue={student.notes ?? ""}
              className="input mt-1"
            />
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
              onClick={() => setEditing(false)}
            >
              Cancelar
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="panel flex items-start justify-between gap-3 p-4">
      <div>
        <p className="font-semibold">{student.name}</p>
        {student.phone && (
          <p className="text-sm text-[var(--ink-muted)]">{student.phone}</p>
        )}
        {student.notes && (
          <p className="mt-1 text-sm text-[var(--ink-muted)]">{student.notes}</p>
        )}
      </div>
      <div className="flex flex-col items-end gap-2">
        <button
          type="button"
          className="text-sm font-medium text-[var(--accent)] hover:underline"
          onClick={() => setEditing(true)}
        >
          Editar
        </button>
        <DeleteStudentButton id={student.id} />
      </div>
    </li>
  );
}
