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
import { findScheduleConflict } from "@/lib/lessons/conflicts";
import {
  canCancelLesson,
  canCompleteLesson,
  canEditLesson,
  canMarkMissed,
  canRescheduleLesson,
  canRevertLessonStatus,
  shouldClosePackageAfterComplete,
  shouldReopenPackageAfterRevert,
} from "@/lib/lessons/rules";

async function renumberCompletedSequences(
  supabase: Awaited<ReturnType<typeof createClient>>,
  packageId: string,
) {
  const { data: completed } = await supabase
    .from("lessons")
    .select("id")
    .eq("package_id", packageId)
    .eq("status", "completed")
    .order("completed_at", { ascending: true });

  for (let i = 0; i < (completed ?? []).length; i++) {
    await supabase
      .from("lessons")
      .update({ sequence_number: i + 1 })
      .eq("id", completed![i].id);
  }

  return (completed ?? []).length;
}

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

  const pkg = lesson.lesson_packages as {
    total_lessons: number;
    title: string;
    students: { name: string } | null;
  } | null;

  if (!pkg) {
    return { error: "Pacote não encontrado" };
  }

  const { count } = await supabase
    .from("lessons")
    .select("*", { count: "exact", head: true })
    .eq("package_id", lesson.package_id)
    .eq("status", "completed");

  const gate = canCompleteLesson(lesson.status, count ?? 0, pkg.total_lessons);
  if (!gate.ok) {
    return { error: gate.error };
  }

  // Claim atômico primeiro; sequência é renumerada depois (evita corrida).
  const { data: claimed, error: updateError } = await supabase
    .from("lessons")
    .update({
      status: "completed",
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

  const completedCount = await renumberCompletedSequences(
    supabase,
    lesson.package_id,
  );

  if (completedCount > pkg.total_lessons) {
    await supabase
      .from("lessons")
      .update({
        status: "scheduled",
        sequence_number: null,
        completed_at: null,
      })
      .eq("id", lessonId)
      .eq("teacher_id", user.id);
    await renumberCompletedSequences(supabase, lesson.package_id);
    return {
      error: `Este pacote já tem todas as ${pkg.total_lessons} aulas concluídas`,
    };
  }

  const { data: numbered } = await supabase
    .from("lessons")
    .select("sequence_number")
    .eq("id", lessonId)
    .single();

  const sequenceNumber = numbered?.sequence_number ?? completedCount;
  const isLastLesson = shouldClosePackageAfterComplete(
    completedCount,
    pkg.total_lessons,
  );

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

  const gate = canMarkMissed(lesson.status);
  if (!gate.ok) {
    return { error: gate.error };
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

  const pkg = lesson.lesson_packages as {
    id: string;
    status: string;
    total_lessons: number;
    students: { name: string } | null;
  } | null;

  if (!pkg) {
    return { error: "Pacote não encontrado" };
  }

  const oldDate = lesson.scheduled_at;
  const previousStatus = lesson.status;
  const newIso = saoPauloInputToIso(newScheduledAt);
  if (!newIso) {
    return { error: "Data inválida" };
  }

  let completed = 0;
  let scheduled = 0;
  if (previousStatus === "missed") {
    const { data: siblings } = await supabase
      .from("lessons")
      .select("status")
      .eq("package_id", lesson.package_id);

    completed = (siblings ?? []).filter((l) => l.status === "completed")
      .length;
    scheduled = (siblings ?? []).filter((l) => l.status === "scheduled")
      .length;
  }

  const gate = canRescheduleLesson({
    lessonStatus: previousStatus,
    packageStatus: pkg.status,
    totalLessons: pkg.total_lessons,
    completed,
    scheduled,
  });
  if (!gate.ok) {
    return { error: gate.error };
  }

  const conflict = await findScheduleConflict(supabase, user.id, newIso, {
    excludeLessonId: lessonId,
  });
  if (conflict) {
    return { error: conflict.message };
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

  const gate = canEditLesson(lesson.status);
  if (!gate.ok) {
    return { error: gate.error };
  }

  const conflict = await findScheduleConflict(supabase, user.id, scheduledAt, {
    excludeLessonId: lessonId,
  });
  if (conflict) {
    return { error: conflict.message };
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

export async function revertLessonStatus(lessonId: string) {
  const { supabase, user } = await requireUser();

  const { data: lesson, error: lessonError } = await supabase
    .from("lessons")
    .select(
      `
      id,
      status,
      package_id,
      lesson_packages (
        id,
        status,
        total_lessons
      )
    `,
    )
    .eq("id", lessonId)
    .eq("teacher_id", user.id)
    .single();

  if (lessonError || !lesson) {
    return { error: "Aula não encontrada" };
  }

  const pkg = lesson.lesson_packages as {
    id: string;
    status: string;
    total_lessons: number;
  } | null;

  if (!pkg) {
    return { error: "Pacote não encontrado" };
  }

  let completed = 0;
  let scheduled = 0;
  if (lesson.status === "missed" || lesson.status === "cancelled") {
    const { data: siblings } = await supabase
      .from("lessons")
      .select("status")
      .eq("package_id", lesson.package_id);

    completed = (siblings ?? []).filter((l) => l.status === "completed")
      .length;
    scheduled = (siblings ?? []).filter((l) => l.status === "scheduled")
      .length;
  }

  const gate = canRevertLessonStatus({
    lessonStatus: lesson.status,
    totalLessons: pkg.total_lessons,
    completed,
    scheduled,
  });
  if (!gate.ok) {
    return { error: gate.error };
  }

  const previousStatus = lesson.status;

  const { data: updated, error } = await supabase
    .from("lessons")
    .update({
      status: "scheduled",
      sequence_number: null,
      completed_at: null,
    })
    .eq("id", lessonId)
    .eq("teacher_id", user.id)
    .eq("status", previousStatus)
    .select("id")
    .maybeSingle();

  if (error) return { error: error.message };
  if (!updated) {
    return { error: "Esta aula já foi atualizada. Atualize a página." };
  }

  if (previousStatus === "completed") {
    await renumberCompletedSequences(supabase, lesson.package_id);

    if (shouldReopenPackageAfterRevert(previousStatus, pkg.status)) {
      await supabase
        .from("lesson_packages")
        .update({ status: "active" })
        .eq("id", lesson.package_id)
        .eq("teacher_id", user.id);
    }
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

  const gate = canCancelLesson(lesson.status);
  if (!gate.ok) {
    return { error: gate.error };
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
