"use client";

import { useTransition } from "react";
import { markPackagePaid } from "@/lib/payments/actions";

export function MarkPaidButton({ packageId }: { packageId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      className="btn-primary px-3 py-1.5 text-sm"
      onClick={() => {
        startTransition(async () => {
          await markPackagePaid(packageId);
        });
      }}
    >
      {pending ? "..." : "Marcar pago"}
    </button>
  );
}
