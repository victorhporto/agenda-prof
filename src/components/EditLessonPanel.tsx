"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelLesson, updateLesson } from "@/lib/lessons/actions";
import { formatShortDate } from "@/lib/utils";
import { toSaoPauloInputValue } from "@/lib/timezone";

type Props = {
  lessonId: string;
  status: string;
  scheduledAt: string;
  notes: string | null;
};

export function EditLessonPanel({
  lessonId,
  status,
  scheduledAt,
  notes,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [scheduledValue, setScheduledValue] = useState(() =>
    toSaoPauloInputValue(scheduledAt),
  );
  const [notesValue, setNotesValue] = useState(notes ?? "");

  if (status !== "scheduled") {
    return null;
  }

  function save(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await updateLesson(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  function onCancel() {
    if (
      !confirm(
        "Cancelar esta aula? A vaga volta para o pacote. Isso é diferente de remarcar.",
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await cancelLesson(lessonId);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          className="btn-secondary flex-1"
          disabled={pending}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Fechar edição" : "Editar data / notas"}
        </button>
        <button
          type="button"
          className="btn-danger flex-1"
          disabled={pending}
          onClick={onCancel}
        >
          Cancelar aula
        </button>
      </div>

      {open && (
        <form action={save} className="panel space-y-4 p-4">
          <input type="hidden" name="lesson_id" value={lessonId} />
          <p className="text-sm text-[var(--ink-muted)]">
            Atual: {formatShortDate(scheduledAt)}
          </p>
          <label className="block text-sm font-medium text-[var(--ink-muted)]">
            Data e horário
            <input
              name="scheduled_at"
              type="datetime-local"
              required
              value={scheduledValue}
              onChange={(e) => setScheduledValue(e.target.value)}
              className="input mt-1"
            />
          </label>
          <label className="block text-sm font-medium text-[var(--ink-muted)]">
            Observações
            <textarea
              name="notes"
              rows={3}
              value={notesValue}
              onChange={(e) => setNotesValue(e.target.value)}
              className="input mt-1"
              placeholder="Opcional"
            />
          </label>
          <button type="submit" disabled={pending} className="btn-primary w-full">
            {pending ? "Salvando..." : "Salvar alterações"}
          </button>
        </form>
      )}

      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
