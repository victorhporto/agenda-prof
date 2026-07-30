"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  completedLessonMessage,
  missedLessonMessage,
  rescheduledLessonMessage,
} from "@/lib/messages/templates";

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
      "msg_completed, msg_missed, msg_rescheduled, msg_signature, msg_signature_enabled",
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

  const { error: updateError } = await supabase
    .from("lessons")
    .update({
      status: "completed",
      sequence_number: sequenceNumber,
      completed_at: new Date().toISOString(),
    })
    .eq("id", lessonId);

  if (updateError) {
    return { error: updateError.message };
  }

  if (sequenceNumber >= pkg.total_lessons) {
    await supabase
      .from("lesson_packages")
      .update({ status: "closed" })
      .eq("id", lesson.package_id);
  }

  const remaining = pkg.total_lessons - sequenceNumber;
  const studentName = pkg.students?.name ?? "aluno";
  const templates = await getMessageTemplates(supabase, user.id);
  const message = completedLessonMessage(
    {
      studentName,
      sequenceNumber,
      totalLessons: pkg.total_lessons,
      scheduledAt: lesson.scheduled_at,
      remaining,
    },
    templates?.msg_completed,
    signatureFrom(templates),
  );

  revalidatePath("/agenda");
  revalidatePath("/pacotes");
  revalidatePath(`/aulas/${lessonId}`);

  return { message, sequenceNumber, remaining };
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

  const { error: updateError } = await supabase
    .from("lessons")
    .update({ status: "missed" })
    .eq("id", lessonId);

  if (updateError) {
    return { error: updateError.message };
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

  revalidatePath("/agenda");
  revalidatePath("/pacotes");
  revalidatePath(`/aulas/${lessonId}`);

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

  const oldDate = lesson.scheduled_at;

  const { error: updateError } = await supabase
    .from("lessons")
    .update({ status: "rescheduled" })
    .eq("id", lessonId);

  if (updateError) {
    return { error: updateError.message };
  }

  const { data: newLesson, error: insertError } = await supabase
    .from("lessons")
    .insert({
      teacher_id: user.id,
      package_id: lesson.package_id,
      scheduled_at: new Date(newScheduledAt).toISOString(),
      status: "scheduled",
      rescheduled_from_id: lessonId,
    })
    .select()
    .single();

  if (insertError || !newLesson) {
    await supabase
      .from("lessons")
      .update({ status: lesson.status })
      .eq("id", lessonId);
    return { error: insertError?.message ?? "Erro ao criar nova aula" };
  }

  const pkg = lesson.lesson_packages as {
    students: { name: string } | null;
  } | null;
  const studentName = pkg?.students?.name ?? "aluno";
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

  revalidatePath("/agenda");
  revalidatePath("/pacotes");
  revalidatePath(`/aulas/${lessonId}`);
  revalidatePath(`/aulas/${newLesson.id}`);

  return { message, newLessonId: newLesson.id };
}
