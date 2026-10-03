"use client";

import { useState, useTransition } from "react";
import { duplicatePackage } from "@/lib/packages/actions";

export function RepeatPackageButton({
  packageId,
  compact = false,
}: {
  packageId: string;
  compact?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={pending}
        className={compact ? "text-sm font-medium text-[var(--accent)] hover:underline disabled:opacity-50" : "btn-primary"}
        onClick={() => {
          if (
            !confirm(
              "Criar um novo pacote com os mesmos dados e agendar as aulas no período seguinte pelo horário reservado do aluno (sem reserva, repete dia da semana, horário e local do pacote atual)? O pagamento começará pendente.",
            )
          ) {
            return;
          }
          setError(null);
          startTransition(async () => {
            const result = await duplicatePackage(packageId);
            if (result?.error) setError(result.error);
          });
        }}
      >
        {pending ? "Criando..." : compact ? "Repetir pacote →" : "Repetir pacote"}
      </button>
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
