"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createPackage(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const studentId = String(formData.get("student_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const totalLessons = Number(formData.get("total_lessons"));
  const priceRaw = String(formData.get("price") ?? "").trim();
  const price = priceRaw ? Number(priceRaw) : null;

  if (!studentId) return { error: "Selecione um aluno" };
  if (!title) return { error: "Título é obrigatório" };
  if (!Number.isFinite(totalLessons) || totalLessons < 1) {
    return { error: "Total de aulas deve ser pelo menos 1" };
  }

  const { data, error } = await supabase
    .from("lesson_packages")
    .insert({
      teacher_id: user.id,
      student_id: studentId,
      title,
      total_lessons: totalLessons,
      price,
      status: "active",
    })
    .select("id")
    .single();

  if (error || !data) return { error: error?.message ?? "Erro ao criar pacote" };

  revalidatePath("/pacotes");
  redirect(`/pacotes/${data.id}`);
}

export async function createLesson(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const packageId = String(formData.get("package_id") ?? "");
  const scheduledAt = String(formData.get("scheduled_at") ?? "");
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!packageId) return { error: "Pacote obrigatório" };
  if (!scheduledAt) return { error: "Data obrigatória" };

  const { data: pkg, error: pkgError } = await supabase
    .from("lesson_packages")
    .select("id, total_lessons, status")
    .eq("id", packageId)
    .eq("teacher_id", user.id)
    .single();

  if (pkgError || !pkg) return { error: "Pacote não encontrado" };
  if (pkg.status === "closed") {
    return { error: "Pacote encerrado — não é possível agendar mais aulas" };
  }

  const { data: lessons } = await supabase
    .from("lessons")
    .select("status")
    .eq("package_id", packageId);

  const completed = (lessons ?? []).filter((l) => l.status === "completed").length;
  const scheduled = (lessons ?? []).filter((l) => l.status === "scheduled").length;

  if (completed + scheduled >= pkg.total_lessons) {
    return {
      error: `Limite do pacote atingido (${pkg.total_lessons} aulas). Conclua ou remarque antes de agendar outra.`,
    };
  }

  const { data: lesson, error } = await supabase
    .from("lessons")
    .insert({
      teacher_id: user.id,
      package_id: packageId,
      scheduled_at: new Date(scheduledAt).toISOString(),
      status: "scheduled",
      notes,
    })
    .select("id")
    .single();

  if (error || !lesson) return { error: error?.message ?? "Erro ao agendar" };

  revalidatePath("/agenda");
  revalidatePath(`/pacotes/${packageId}`);
  redirect(`/aulas/${lesson.id}`);
}

export async function closePackage(packageId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const { error } = await supabase
    .from("lesson_packages")
    .update({ status: "closed" })
    .eq("id", packageId)
    .eq("teacher_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/pacotes");
  revalidatePath(`/pacotes/${packageId}`);
  return { success: true };
}
