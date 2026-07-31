"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { closePackage } from "@/lib/packages/actions";

export function ClosePackageButton({
  packageId,
  scheduledCount = 0,
}: {
  packageId: string;
  scheduledCount?: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function finish(cancelScheduled: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await closePackage(packageId, { cancelScheduled });
      if (result?.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        disabled={pending}
        className="btn-secondary"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        Encerrar pacote
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="close-package-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !pending) setOpen(false);
          }}
        >
          <div className="panel w-full max-w-md space-y-4 p-5 shadow-lg">
            <div>
              <h2
                id="close-package-title"
                className="font-display text-xl font-bold"
              >
                Encerrar pacote?
              </h2>
              <p className="mt-1 text-sm text-[var(--ink-muted)]">
                O pacote deixa de aceitar novas aulas. Você pode reabri-lo
                depois se ainda houver saldo.
              </p>
            </div>

            {scheduledCount > 0 ? (
              <p className="rounded-lg bg-[var(--warning-soft)] px-3 py-2 text-sm text-[var(--warning)]">
                Há {scheduledCount} aula
                {scheduledCount === 1 ? "" : "s"} ainda agendada
                {scheduledCount === 1 ? "" : "s"}. Escolha o que fazer com
                {scheduledCount === 1 ? " ela" : " elas"}:
              </p>
            ) : null}

            {error && <p className="form-error">{error}</p>}

            <div className="flex flex-col gap-2">
              {scheduledCount > 0 ? (
                <>
                  <button
                    type="button"
                    disabled={pending}
                    className="btn-danger w-full"
                    onClick={() => finish(true)}
                  >
                    {pending
                      ? "Encerrando..."
                      : "Cancelar aulas agendadas e encerrar"}
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    className="btn-primary w-full"
                    onClick={() => finish(false)}
                  >
                    {pending
                      ? "Encerrando..."
                      : "Manter aulas na agenda e encerrar"}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  disabled={pending}
                  className="btn-primary w-full"
                  onClick={() => finish(false)}
                >
                  {pending ? "Encerrando..." : "Encerrar pacote"}
                </button>
              )}
              <button
                type="button"
                disabled={pending}
                className="btn-secondary w-full"
                onClick={() => setOpen(false)}
              >
                Voltar (não encerrar)
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
