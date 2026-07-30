import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LessonActions } from "@/components/LessonActions";
import { CopyMessage } from "@/components/CopyMessage";
import {
  completedLessonMessage,
  missedLessonMessage,
  rescheduledLessonMessage,
} from "@/lib/messages/templates";
import { formatShortDate, statusLabel } from "@/lib/utils";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ msg?: string }>;
};

export default async function AulaDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { msg } = await searchParams;
  const supabase = await createClient();

  const { data: lesson } = await supabase
    .from("lessons")
    .select(
      `
      *,
      lesson_packages (
        id,
        title,
        total_lessons,
        students ( name, phone )
      )
    `,
    )
    .eq("id", id)
    .single();

  if (!lesson) notFound();

  const pkg = lesson.lesson_packages as {
    id: string;
    title: string;
    total_lessons: number;
    students: { name: string; phone: string | null } | null;
  } | null;

  const studentName = pkg?.students?.name ?? "aluno";

  let storedMessage: string | null = null;
  if (lesson.status === "completed" && lesson.sequence_number && pkg) {
    const remaining = Math.max(
      pkg.total_lessons - lesson.sequence_number,
      0,
    );
    storedMessage = completedLessonMessage({
      studentName,
      sequenceNumber: lesson.sequence_number,
      totalLessons: pkg.total_lessons,
      scheduledAt: lesson.scheduled_at,
      remaining,
    });
  } else if (lesson.status === "missed") {
    storedMessage = missedLessonMessage({
      studentName,
      scheduledAt: lesson.scheduled_at,
    });
  } else if (lesson.status === "scheduled" && lesson.rescheduled_from_id) {
    const { data: oldLesson } = await supabase
      .from("lessons")
      .select("scheduled_at")
      .eq("id", lesson.rescheduled_from_id)
      .single();
    if (oldLesson) {
      storedMessage = rescheduledLessonMessage({
        studentName,
        oldDate: oldLesson.scheduled_at,
        newDate: lesson.scheduled_at,
      });
    }
  }

  const showStored = Boolean(msg) || lesson.status !== "scheduled" || storedMessage;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/agenda"
          className="text-sm font-medium text-[var(--accent)]"
        >
          ← Agenda
        </Link>
        <div className="mt-2 flex items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">
              {studentName}
            </h1>
            <p className="mt-1 text-[var(--ink-muted)]">
              {formatShortDate(lesson.scheduled_at)}
            </p>
          </div>
          <span className={`badge badge-${lesson.status}`}>
            {statusLabel(lesson.status)}
          </span>
        </div>
      </div>

      <div className="panel space-y-2 p-5 text-sm">
        <p>
          <span className="text-[var(--ink-muted)]">Pacote:</span>{" "}
          <Link
            href={`/pacotes/${pkg?.id}`}
            className="font-medium text-[var(--accent)]"
          >
            {pkg?.title}
          </Link>
        </p>
        {lesson.sequence_number && pkg && (
          <p>
            <span className="text-[var(--ink-muted)]">Progresso:</span> Aula{" "}
            {lesson.sequence_number} de {pkg.total_lessons}
          </p>
        )}
        {pkg?.students?.phone && (
          <p>
            <span className="text-[var(--ink-muted)]">WhatsApp:</span>{" "}
            {pkg.students.phone}
          </p>
        )}
        {lesson.notes && (
          <p>
            <span className="text-[var(--ink-muted)]">Obs:</span> {lesson.notes}
          </p>
        )}
      </div>

      <LessonActions
        lessonId={lesson.id}
        status={lesson.status}
        phone={pkg?.students?.phone}
      />

      {showStored && storedMessage && lesson.status !== "scheduled" && (
        <div>
          <h2 className="mb-2 text-sm font-semibold text-[var(--ink-muted)]">
            Mensagem para enviar
          </h2>
          <CopyMessage
            message={storedMessage}
            phone={pkg?.students?.phone}
          />
        </div>
      )}

      {msg && lesson.status === "scheduled" && storedMessage && (
        <div>
          <h2 className="mb-2 text-sm font-semibold text-[var(--ink-muted)]">
            Mensagem de remarcação
          </h2>
          <CopyMessage
            message={storedMessage}
            phone={pkg?.students?.phone}
          />
        </div>
      )}
    </div>
  );
}
