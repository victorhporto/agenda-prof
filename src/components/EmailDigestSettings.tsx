"use client";

import { useState, useTransition } from "react";
import { updateNotifyEmail } from "@/lib/notifications/actions";

export function EmailDigestSettings({
  initialEnabled,
  email,
}: {
  initialEnabled: boolean;
  email: string | null;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onToggle(next: boolean) {
    setError(null);
    setEnabled(next);
    startTransition(async () => {
      const result = await updateNotifyEmail(next);
      if (result?.error) {
        setEnabled(!next);
        setError(result.error);
      }
    });
  }

  return (
    <section className="panel space-y-3 p-5">
      <div>
        <h2 className="text-lg font-semibold">Notificações</h2>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          Resumo diário por e-mail às 8h (horário de Brasília), só quando houver
          aulas, atrasos ou pacotes acabando.
        </p>
      </div>

      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 accent-[var(--accent)]"
          checked={enabled}
          disabled={pending || !email}
          onChange={(e) => onToggle(e.target.checked)}
        />
        <span>
          <span className="block font-medium">Receber resumo do dia</span>
          <span className="block text-sm text-[var(--ink-muted)]">
            {email
              ? `Enviado para ${email}`
              : "Sua conta não tem e-mail cadastrado."}
          </span>
        </span>
      </label>

      {error && <p className="form-error">{error}</p>}
    </section>
  );
}
