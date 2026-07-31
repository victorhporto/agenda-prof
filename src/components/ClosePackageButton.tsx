"use client";

import { useTransition } from "react";
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
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      className="btn-secondary"
      onClick={() => {
        if (!confirm("Encerrar este pacote?")) return;

        let cancelScheduled = false;
        if (scheduledCount > 0) {
          cancelScheduled = confirm(
            `Há ${scheduledCount} aula${scheduledCount === 1 ? "" : "s"} ainda agendada${scheduledCount === 1 ? "" : "s"}.\n\nOK = cancelar essas aulas e encerrar\nCancelar = encerrar mantendo as aulas na agenda`,
          );
        }

        startTransition(async () => {
          await closePackage(packageId, { cancelScheduled });
          router.refresh();
        });
      }}
    >
      {pending ? "Encerrando..." : "Encerrar pacote"}
    </button>
  );
}
