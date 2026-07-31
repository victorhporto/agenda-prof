"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { markPackagePaid } from "@/lib/payments/actions";

export function MarkPaidButton({ packageId }: { packageId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      className="btn-primary px-3 py-1.5 text-sm"
      onClick={() => {
        startTransition(async () => {
          await markPackagePaid(packageId);
          router.refresh();
        });
      }}
    >
      {pending ? "..." : "Marcar pago"}
    </button>
  );
}
