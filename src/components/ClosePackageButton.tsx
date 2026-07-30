"use client";

import { useTransition } from "react";
import { closePackage } from "@/lib/packages/actions";

export function ClosePackageButton({ packageId }: { packageId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      className="btn-secondary"
      onClick={() => {
        if (!confirm("Encerrar este pacote?")) return;
        startTransition(async () => {
          await closePackage(packageId);
        });
      }}
    >
      Encerrar pacote
    </button>
  );
}
