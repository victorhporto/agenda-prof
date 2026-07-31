"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { revertLessonStatus } from "@/lib/lessons/actions";

export function RevertLessonButton({
  lessonId,
  status,
}: {
  lessonId: string;
  status: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (
    status !== "completed" &&
    status !== "missed" &&
    status !== "cancelled"
  ) {
    return null;
  }

  const label =
    status === "completed"
      ? "Desfazer OK (voltar para agendada)"
      : status === "missed"
        ? "Desfazer falta (voltar para agendada)"
        : "Desfazer cancelamento (voltar para agendada)";

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={pending}
        className="btn-secondary w-full"
        onClick={() => {
          if (
            !confirm(
              "Voltar esta aula para agendada? O status atual será desfeito.",
            )
          ) {
            return;
          }
          setError(null);
          startTransition(async () => {
            const result = await revertLessonStatus(lessonId);
            if (result?.error) {
              setError(result.error);
              return;
            }
            router.refresh();
          });
        }}
      >
        {pending ? "Desfazendo..." : label}
      </button>
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
