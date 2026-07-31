"use client";

import Link from "next/link";
import { useState, useTransition, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { completeLesson } from "@/lib/lessons/actions";
import { formatLessonDate, statusLabel } from "@/lib/utils";

type Props = {
  lessonId: string;
  scheduledAt: string;
  status: string;
  sequenceNumber: number | null;
  packageTitle: string | null;
  totalLessons: number | null;
  studentName: string;
};

export function AgendaLessonRow({
  lessonId,
  scheduledAt,
  status,
  sequenceNumber,
  packageTitle,
  totalLessons,
  studentName,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function onQuickOk(e: MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();
    setError(null);
    startTransition(async () => {
      const result = await completeLesson(lessonId);
      if (result.error) {
        setError(result.error);
        return;
      }
      setDone(true);
      router.refresh();
    });
  }

  const displayStatus = done ? "completed" : status;

  return (
    <li className="panel p-4">
      <div className="flex items-start justify-between gap-3">
        <Link
          href={`/aulas/${lessonId}`}
          className="min-w-0 flex-1 transition hover:opacity-90"
        >
          <p className="text-sm font-medium capitalize text-[var(--ink-muted)]">
            {formatLessonDate(scheduledAt)}
          </p>
          <p className="mt-1 text-lg font-semibold">{studentName}</p>
          <p className="text-sm text-[var(--ink-muted)]">
            {packageTitle}
            {sequenceNumber
              ? ` · Aula ${sequenceNumber}/${totalLessons}`
              : ""}
          </p>
        </Link>
        <span className={`badge badge-${displayStatus} shrink-0`}>
          {statusLabel(displayStatus)}
        </span>
      </div>

      {displayStatus === "scheduled" && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={pending}
            className="btn-primary px-3 py-1.5 text-sm"
            onClick={onQuickOk}
          >
            {pending ? "..." : "OK"}
          </button>
          <Link
            href={`/aulas/${lessonId}`}
            className="text-sm font-medium text-[var(--accent)] hover:underline"
          >
            Detalhes →
          </Link>
        </div>
      )}

      {error && <p className="form-error mt-2">{error}</p>}
    </li>
  );
}
