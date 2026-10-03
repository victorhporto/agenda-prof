import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LessonActions } from "@/components/LessonActions";
import { EditLessonPanel } from "@/components/EditLessonPanel";
import { RevertLessonButton } from "@/components/RevertLessonButton";
import { CopyMessage } from "@/components/CopyMessage";
import { RideButtons } from "@/components/RideButtons";
import {
  completedLessonMessage,
  missedLessonMessage,
  renewalLessonMessage,
  rescheduledLessonMessage,
} from "@/lib/messages/templates";
import { formatShortDate, statusLabel } from "@/lib/utils";
import {
  LOCATION_LABELS,
  effectiveLocation,
} from "@/lib/lessons/location";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ msg?: string }>;
};

export default async function AulaDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { msg } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: lesson } = await supabase
    .from("lessons")
    .select(
      `
      *,
      lesson_packages (
        id,
        title,
        total_lessons,
        students ( id, name, phone, default_location, address, lat, lng )
      )
    `,
    )
    .eq("id", id)
    .single();

  if (!lesson) notFound();

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "msg_completed, msg_missed, msg_rescheduled, msg_renewal, msg_signature, msg_signature_enabled, base_lat, base_lng",
    )
    .eq("id", user!.id)
    .single();

  const pkg = lesson.lesson_packages as {
    id: string;
    title: string;
    total_lessons: number;
    students: {
      id: string;
      name: string;
      phone: string | null;
      default_location: string | null;
      address: string | null;
      lat: number | null;
      lng: number | null;
    } | null;
  } | null;

  const studentName = pkg?.students?.name ?? "aluno";
  const signature = {
    enabled: profile?.msg_signature_enabled ?? false,
    text: profile?.msg_signature ?? null,
  };
  const lessonLocation = effectiveLocation(
    lesson.location,
    pkg?.students?.default_location,
  );

  const student = pkg?.students;
  const rideDestination =
    lessonLocation === "casa_aluno" && student?.lat != null && student?.lng != null
      ? {
          lat: student.lat,
          lng: student.lng,
          title: student.name,
          address: student.address,
        }
      : null;
  const teacherBase =
    profile?.base_lat != null && profile?.base_lng != null
      ? { lat: profile.base_lat, lng: profile.base_lng }
      : null;

  let storedMessage: string | null = null;
  let renewalMessage: string | null = null;

  if (lesson.status === "completed" && lesson.sequence_number && pkg) {
    const remaining = Math.max(
      pkg.total_lessons - lesson.sequence_number,
      0,
    );
    storedMessage = completedLessonMessage(
      {
        studentName,
        sequenceNumber: lesson.sequence_number,
        totalLessons: pkg.total_lessons,
        scheduledAt: lesson.scheduled_at,
        remaining,
      },
      profile?.msg_completed,
      signature,
    );
    if (remaining === 0) {
      renewalMessage = renewalLessonMessage(
        {
          studentName,
          totalLessons: pkg.total_lessons,
          packageTitle: pkg.title,
          scheduledAt: lesson.scheduled_at,
        },
        profile?.msg_renewal,
        signature,
      );
    }
  } else if (lesson.status === "missed") {
    storedMessage = missedLessonMessage(
      {
        studentName,
        scheduledAt: lesson.scheduled_at,
      },
      profile?.msg_missed,
      signature,
    );
  } else if (lesson.status === "scheduled" && lesson.rescheduled_from_id) {
    const { data: oldLesson } = await supabase
      .from("lessons")
      .select("scheduled_at")
      .eq("id", lesson.rescheduled_from_id)
      .single();
    if (oldLesson) {
      storedMessage = rescheduledLessonMessage(
        {
          studentName,
          oldDate: oldLesson.scheduled_at,
          newDate: lesson.scheduled_at,
        },
        profile?.msg_rescheduled,
        signature,
      );
    }
  }

  const showStored =
    Boolean(msg) || lesson.status !== "scheduled" || storedMessage;

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
        {lessonLocation && (
          <p>
            <span className="text-[var(--ink-muted)]">Local:</span>{" "}
            {LOCATION_LABELS[lessonLocation]}
          </p>
        )}
        {lesson.notes && (
          <p>
            <span className="text-[var(--ink-muted)]">Obs:</span> {lesson.notes}
          </p>
        )}
        {rideDestination ? (
          <div className="pt-2">
            <RideButtons destination={rideDestination} base={teacherBase} />
          </div>
        ) : lessonLocation === "casa_aluno" && student ? (
          <p className="text-[var(--ink-muted)]">
            Para chamar Uber ou 99 daqui,{" "}
            <Link href="/alunos" className="font-medium text-[var(--accent)]">
              cadastre o endereço do aluno
            </Link>
            .
          </p>
        ) : null}
      </div>

      <EditLessonPanel
        lessonId={lesson.id}
        status={lesson.status}
        scheduledAt={lesson.scheduled_at}
        notes={lesson.notes}
        location={lessonLocation}
      />

      <LessonActions
        lessonId={lesson.id}
        status={lesson.status}
        phone={pkg?.students?.phone}
      />

      <RevertLessonButton lessonId={lesson.id} status={lesson.status} />

      {showStored && storedMessage && lesson.status !== "scheduled" && (
        <CopyMessage
          title="Mensagem da aula"
          message={storedMessage}
          phone={pkg?.students?.phone}
        />
      )}

      {renewalMessage && (
        <CopyMessage
          title="Lembrete de renovação"
          message={renewalMessage}
          phone={pkg?.students?.phone}
        />
      )}

      {msg && lesson.status === "scheduled" && storedMessage && (
        <CopyMessage
          title="Mensagem de remarcação"
          message={storedMessage}
          phone={pkg?.students?.phone}
        />
      )}
    </div>
  );
}
