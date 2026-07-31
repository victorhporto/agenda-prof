"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reopenPackage } from "@/lib/packages/actions";

export function ReopenPackageButton({ packageId }: { packageId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={pending}
        className="btn-secondary"
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await reopenPackage(packageId);
            if (result?.error) {
              setError(result.error);
              return;
            }
            router.refresh();
          });
        }}
      >
        {pending ? "Reabrindo..." : "Reabrir pacote"}
      </button>
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
