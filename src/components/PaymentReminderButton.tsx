"use client";

import { useState, useTransition } from "react";
import { buildPaymentReminder } from "@/lib/payments/actions";
import { CopyMessage } from "@/components/CopyMessage";

export function PaymentReminderButton({ packageId }: { packageId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await buildPaymentReminder(packageId);
      if (result.error) {
        setError(result.error);
        return;
      }
      setMessage(result.message ?? null);
      setPhone(result.phone ?? null);
    });
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled={pending}
        onClick={handleClick}
        className="btn-secondary w-full"
      >
        {pending ? "Gerando..." : "Lembrete de pagamento"}
      </button>
      {error && (
        <p className="form-error">
          {error}
        </p>
      )}
      {message && (
        <CopyMessage
          title="Lembrete de pagamento"
          message={message}
          phone={phone}
        />
      )}
    </div>
  );
}
