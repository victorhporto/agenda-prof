"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  completeLesson,
  markLessonMissed,
  rescheduleLesson,
} from "@/lib/lessons/actions";
import { CopyMessage } from "@/components/CopyMessage";
import { toSaoPauloInputValue } from "@/lib/timezone";

type Props = {
  lessonId: string;
  status: string;
  phone?: string | null;
};

export function LessonActions({ lessonId, status, phone }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [renewalMessage, setRenewalMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showReschedule, setShowReschedule] = useState(false);
  const [newDate, setNewDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(10, 0, 0, 0);
    return toSaoPauloInputValue(d);
  });

  function run(
    action: () => Promise<{
      error?: string;
      message?: string;
      renewalMessage?: string | null;
      newLessonId?: string;
    }>,
  ) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.message) setMessage(result.message);
      setRenewalMessage(result.renewalMessage ?? null);
      if (result.newLessonId) {
        router.push(`/aulas/${result.newLessonId}?msg=1`);
        router.refresh();
        return;
      }
      router.refresh();
    });
  }

  if (status !== "scheduled" && status !== "missed") {
    return null;
  }

  return (
    <div className="space-y-4">
      {status === "scheduled" && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            disabled={pending}
            className="btn-primary flex-1"
            onClick={() => run(() => completeLesson(lessonId))}
          >
            OK — aula dada
          </button>
          <button
            type="button"
            disabled={pending}
            className="btn-danger flex-1"
            onClick={() => run(() => markLessonMissed(lessonId))}
          >
            Não foi dada
          </button>
          <button
            type="button"
            disabled={pending}
            className="btn-secondary flex-1"
            onClick={() => setShowReschedule((v) => !v)}
          >
            Remarcar
          </button>
        </div>
      )}

      {status === "missed" && (
        <button
          type="button"
          disabled={pending}
          className="btn-primary w-full"
          onClick={() => setShowReschedule((v) => !v)}
        >
          Remarcar aula
        </button>
      )}

      {showReschedule && (
        <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <label className="block text-sm font-medium text-[var(--ink-muted)]">
            Nova data e horário
            <input
              type="datetime-local"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="input mt-1"
            />
          </label>
          <button
            type="button"
            disabled={pending || !newDate}
            className="btn-primary w-full"
            onClick={() => run(() => rescheduleLesson(lessonId, newDate))}
          >
            Confirmar remarcação
          </button>
        </div>
      )}

      {error && (
        <p className="form-error">
          {error}
        </p>
      )}

      {message && (
        <CopyMessage
          title="Mensagem da aula"
          message={message}
          phone={phone}
        />
      )}
      {renewalMessage && (
        <CopyMessage
          title="Lembrete de renovação"
          message={renewalMessage}
          phone={phone}
        />
      )}
    </div>
  );
}
