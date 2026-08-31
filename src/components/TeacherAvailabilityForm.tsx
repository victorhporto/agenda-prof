"use client";

import { useState, useTransition, type FormEvent } from "react";
import { TeacherWindowsEditor } from "@/components/TeacherWindowsEditor";
import { updateTeacherWindows } from "@/lib/profile/actions";
import {
  parseTeacherWindows,
  type TeacherWindow,
} from "@/lib/assistente/occupancy";

export function TeacherAvailabilityForm({
  initialWindows,
  saved,
}: {
  initialWindows: TeacherWindow[];
  saved: boolean;
}) {
  const [windows, setWindows] = useState(initialWindows);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setOk(false);
    const parsed = parseTeacherWindows(windows);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    startTransition(async () => {
      const result = await updateTeacherWindows(windows);
      if (result.error) {
        setError(result.error);
        return;
      }
      setOk(true);
    });
  }

  return (
    <form onSubmit={onSubmit} className="panel space-y-4 p-5">
      <div>
        <h2 className="text-lg font-semibold">Horário de atendimento</h2>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          {saved
            ? "O Assistente usa este horário automaticamente. Você só muda aqui quando a rotina mudar."
            : "Ainda no padrão (segunda a sexta, 10h–20h). Salve para o Assistente lembrar da próxima vez."}
        </p>
      </div>

      <TeacherWindowsEditor value={windows} onChange={setWindows} />

      {error && <p className="form-error">{error}</p>}
      {ok && (
        <p className="text-sm font-medium text-[var(--accent)]">
          Horário salvo. O Assistente já usa este padrão.
        </p>
      )}

      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "Salvando..." : "Salvar horário"}
      </button>
    </form>
  );
}
