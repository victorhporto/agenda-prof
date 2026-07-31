"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  completedLessonMessage,
  missedLessonMessage,
  renewalLessonMessage,
  rescheduledLessonMessage,
} from "@/lib/messages/templates";
import { saoPauloInputToIso } from "@/lib/timezone";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");
  return { supabase, user };
}

async function getMessageTemplates(
  supabase: Awaited<ReturnType<typeof createClient>>,
  teacherId: string,
) {
  const { data } = await supabase
    .from("profiles")
    .select(
      "msg_completed, msg_missed, msg_rescheduled, msg_renewal, msg_payment_reminder, msg_signature, msg_signature_enabled",
    )
    .eq("id", teacherId)
    .single();
  return data;
}

function signatureFrom(templates: {
  msg_signature: string | null;
  msg_signature_enabled: boolean;
} | null) {
  return {
    enabled: templates?.msg_signature_enabled ?? false,
    text: templates?.msg_signature ?? null,
  };
}

function revalidateLessonPaths(
  lessonId: string,
  packageId: string,
  extraLessonId?: string,
) {
  revalidatePath("/agenda");
  revalidatePath("/inicio");
  revalidatePath("/pacotes");
  revalidatePath(`/pacotes/${packageId}`);
  revalidatePath(`/aulas/${lessonId}`);
  if (extraLessonId) revalidatePath(`/aulas/${extraLessonId}`);
}

export async function completeLesson(lessonId: string) {
  const { supabase, user } = await requireUser();

  const { data: lesson, error: lessonError } = await supabase
    .from("lessons")
    .select(
      `
      *,
      lesson_packages (
        id,
        total_lessons,
        title,
        students ( name )
      )
    `,
    )
    .eq("id", lessonId)
    .eq("teacher_id", user.id)
    .single();

  if (lessonError || !lesson) {
    return { error: "Aula não encontrada" };
  }

  if (lesson.status !== "scheduled") {
    return { error: "Só é possível concluir aulas agendadas" };
  }

  const { count } = await supabase
    .from("lessons")
    .select("*", { count: "exact", head: true })
    .eq("package_id", lesson.package_id)
    .eq("status", "completed");

  const sequenceNumber = (count ?? 0) + 1;
  const pkg = lesson.lesson_packages as {
    total_lessons: number;
    title: string;
    students: { name: string } | null;
  } | null;

  if (!pkg) {
    return { error: "Pacote não encontrado" };
  }

  if (sequenceNumber > pkg.total_lessons) {
    return {
      error: `Este pacote já tem todas as ${pkg.total_lessons} aulas concluídas`,
    };
  }

  const { data: claimed, error: updateError } = await supabase
    .from("lessons")
    .update({
      status: "completed",
      sequence_number: sequenceNumber,
      completed_at: new Date().toISOString(),
    })
    .eq("id", lessonId)
    .eq("teacher_id", user.id)
    .eq("status", "scheduled")
    .select("id")
    .maybeSingle();

  if (updateError) {
    return { error: updateError.message };
  }
  if (!claimed) {
    return { error: "Esta aula já foi atualizada. Atualize a página." };
  }

  const isLastLesson = sequenceNumber >= pkg.total_lessons;

  if (isLastLesson) {
    await supabase
      .from("lesson_packages")
      .update({ status: "closed" })
      .eq("id", lesson.package_id);
  }

  const remaining = pkg.total_lessons - sequenceNumber;
  const studentName = pkg.students?.name ?? "aluno";
  const templates = await getMessageTemplates(supabase, user.id);
  const signature = signatureFrom(templates);
  const message = completedLessonMessage(
    {
      studentName,
      sequenceNumber,
      totalLessons: pkg.total_lessons,
      scheduledAt: lesson.scheduled_at,
      remaining,
    },
    templates?.msg_completed,
    signature,
  );

  const renewalMessage = isLastLesson
    ? renewalLessonMessage(
        {
          studentName,
          totalLessons: pkg.total_lessons,
          packageTitle: pkg.title,
          scheduledAt: lesson.scheduled_at,
        },
        templates?.msg_renewal,
        signature,
      )
    : null;

  revalidateLessonPaths(lessonId, lesson.package_id);

  return { message, renewalMessage, sequenceNumber, remaining };
}

export async function markLessonMissed(lessonId: string) {
  const { supabase, user } = await requireUser();

  const { data: lesson, error: lessonError } = await supabase
    .from("lessons")
    .select(
      `
      *,
      lesson_packages (
        students ( name )
      )
    `,
    )
    .eq("id", lessonId)
    .eq("teacher_id", user.id)
    .single();

  if (lessonError || !lesson) {
    return { error: "Aula não encontrada" };
  }

  if (lesson.status !== "scheduled") {
    return { error: "Só é possível marcar falta em aulas agendadas" };
  }

  const { data: claimed, error: updateError } = await supabase
    .from("lessons")
    .update({ status: "missed" })
    .eq("id", lessonId)
    .eq("teacher_id", user.id)
    .eq("status", "scheduled")
    .select("id")
    .maybeSingle();

  if (updateError) {
    return { error: updateError.message };
  }
  if (!claimed) {
    return { error: "Esta aula já foi atualizada. Atualize a página." };
  }

  const pkg = lesson.lesson_packages as {
    students: { name: string } | null;
  } | null;
  const studentName = pkg?.students?.name ?? "aluno";
  const templates = await getMessageTemplates(supabase, user.id);
  const message = missedLessonMessage(
    {
      studentName,
      scheduledAt: lesson.scheduled_at,
    },
    templates?.msg_missed,
    signatureFrom(templates),
  );

  revalidateLessonPaths(lessonId, lesson.package_id);

  return { message };
}

export async function rescheduleLesson(
  lessonId: string,
  newScheduledAt: string,
) {
  const { supabase, user } = await requireUser();

  const { data: lesson, error: lessonError } = await supabase
    .from("lessons")
    .select(
      `
      *,
      lesson_packages (
        id,
        status,
        total_lessons,
        students ( name )
      )
    `,
    )
    .eq("id", lessonId)
    .eq("teacher_id", user.id)
    .single();

  if (lessonError || !lesson) {
    return { error: "Aula não encontrada" };
  }

  if (lesson.status !== "scheduled" && lesson.status !== "missed") {
    return { error: "Só é possível remarcar aulas agendadas ou com falta" };
  }

  const pkg = lesson.lesson_packages as {
    id: string;
    status: string;
    total_lessons: number;
    students: { name: string } | null;
  } | null;

  if (!pkg) {
    return { error: "Pacote não encontrado" };
  }

  if (pkg.status === "closed") {
    return { error: "Pacote encerrado — não é possível remarcar" };
  }

  const oldDate = lesson.scheduled_at;
  const previousStatus = lesson.status;
  const newIso = saoPauloInputToIso(newScheduledAt);
  if (!newIso) {
    return { error: "Data inválida" };
  }

  // Remarcar falta cria uma nova "scheduled"; precisa haver vaga livre.
  if (previousStatus === "missed") {
    const { data: siblings } = await supabase
      .from("lessons")
      .select("status")
      .eq("package_id", lesson.package_id);

    const completed = (siblings ?? []).filter(
      (l) => l.status === "completed",
    ).length;
    const scheduled = (siblings ?? []).filter(
      (l) => l.status === "scheduled",
    ).length;

    if (completed + scheduled >= pkg.total_lessons) {
      return {
        error:
          "Não há vaga no pacote para remarcar. Cancele outra aula agendada ou aumente o total do pacote.",
      };
    }
  }

  const { data: claimed, error: updateError } = await supabase
    .from("lessons")
    .update({ status: "rescheduled" })
    .eq("id", lessonId)
    .eq("teacher_id", user.id)
    .eq("status", previousStatus)
    .select("id")
    .maybeSingle();

  if (updateError) {
    return { error: updateError.message };
  }
  if (!claimed) {
    return { error: "Esta aula já foi atualizada. Atualize a página." };
  }

  const { data: newLesson, error: insertError } = await supabase
    .from("lessons")
    .insert({
      teacher_id: user.id,
      package_id: lesson.package_id,
      scheduled_at: newIso,
      status: "scheduled",
      rescheduled_from_id: lessonId,
    })
    .select()
    .single();

  if (insertError || !newLesson) {
    await supabase
      .from("lessons")
      .update({ status: previousStatus })
      .eq("id", lessonId)
      .eq("teacher_id", user.id);
    return { error: insertError?.message ?? "Erro ao criar nova aula" };
  }

  const studentName = pkg.students?.name ?? "aluno";
  const templates = await getMessageTemplates(supabase, user.id);
  const message = rescheduledLessonMessage(
    {
      studentName,
      oldDate,
      newDate: newLesson.scheduled_at,
    },
    templates?.msg_rescheduled,
    signatureFrom(templates),
  );

  revalidateLessonPaths(lessonId, lesson.package_id, newLesson.id);

  return { message, newLessonId: newLesson.id };
}

export async function updateLesson(formData: FormData) {
  const { supabase, user } = await requireUser();

  const lessonId = String(formData.get("lesson_id") ?? "");
  const scheduledAtRaw = String(formData.get("scheduled_at") ?? "");
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!lessonId) return { error: "Aula inválida" };

  const scheduledAt = saoPauloInputToIso(scheduledAtRaw);
  if (!scheduledAt) return { error: "Data e horário inválidos" };

  const { data: lesson, error: lessonError } = await supabase
    .from("lessons")
    .select("id, status, package_id")
    .eq("id", lessonId)
    .eq("teacher_id", user.id)
    .single();

  if (lessonError || !lesson) {
    return { error: "Aula não encontrada" };
  }

  if (lesson.status !== "scheduled") {
    return { error: "Só é possível editar aulas ainda agendadas" };
  }

  const { data: updated, error } = await supabase
    .from("lessons")
    .update({
      scheduled_at: scheduledAt,
      notes,
    })
    .eq("id", lessonId)
    .eq("teacher_id", user.id)
    .eq("status", "scheduled")
    .select("id")
    .maybeSingle();

  if (error) return { error: error.message };
  if (!updated) {
    return { error: "Esta aula já foi atualizada. Atualize a página." };
  }

  revalidateLessonPaths(lessonId, lesson.package_id);

  return { success: true as const };
}

export async function cancelLesson(lessonId: string) {
  const { supabase, user } = await requireUser();

  const { data: lesson, error: lessonError } = await supabase
    .from("lessons")
    .select("id, status, package_id")
    .eq("id", lessonId)
    .eq("teacher_id", user.id)
    .single();

  if (lessonError || !lesson) {
    return { error: "Aula não encontrada" };
  }

  if (lesson.status !== "scheduled") {
    return { error: "Só é possível cancelar aulas agendadas" };
  }

  const { data: updated, error } = await supabase
    .from("lessons")
    .update({ status: "cancelled" })
    .eq("id", lessonId)
    .eq("teacher_id", user.id)
    .eq("status", "scheduled")
    .select("id")
    .maybeSingle();

  if (error) return { error: error.message };
  if (!updated) {
    return { error: "Esta aula já foi atualizada. Atualize a página." };
  }

  revalidateLessonPaths(lessonId, lesson.package_id);

  return { success: true as const };
}
