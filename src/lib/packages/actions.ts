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
  const paymentStatus = String(formData.get("payment_status") ?? "pending");
  const paymentDueDate =
    String(formData.get("payment_due_date") ?? "").trim() || null;
  const initialPaid =
    paymentStatus === "paid" && price != null ? price : 0;

  if (!studentId) return { error: "Selecione um aluno" };
  if (!title) return { error: "Título é obrigatório" };
  if (!Number.isFinite(totalLessons) || totalLessons < 1) {
    return { error: "Total de aulas deve ser pelo menos 1" };
  }
  if (!["pending", "paid"].includes(paymentStatus)) {
    return { error: "Status de pagamento inválido" };
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
      payment_status: paymentStatus,
      amount_paid: initialPaid,
      paid_at: paymentStatus === "paid" ? new Date().toISOString() : null,
      payment_due_date: paymentDueDate,
    })
    .select("id")
    .single();

  if (error || !data) return { error: error?.message ?? "Erro ao criar pacote" };

  revalidatePath("/pacotes");
  revalidatePath("/faturamento");
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
  const recurrence = String(formData.get("recurrence") ?? "once");

  if (!packageId) return { error: "Pacote obrigatório" };
  if (!scheduledAt) return { error: "Data obrigatória" };
  if (recurrence !== "once" && recurrence !== "weekly") {
    return { error: "Opção de repetição inválida" };
  }

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
  const remainingSlots = pkg.total_lessons - completed - scheduled;

  if (remainingSlots <= 0) {
    return {
      error: `Limite do pacote atingido (${pkg.total_lessons} aulas). Conclua ou remarque antes de agendar outra.`,
    };
  }

  const count = recurrence === "weekly" ? remainingSlots : 1;
  const start = new Date(scheduledAt);
  if (Number.isNaN(start.getTime())) {
    return { error: "Data inválida" };
  }

  const rows = Array.from({ length: count }, (_, index) => {
    const date = new Date(start);
    date.setDate(date.getDate() + index * 7);
    return {
      teacher_id: user.id,
      package_id: packageId,
      scheduled_at: date.toISOString(),
      status: "scheduled" as const,
      notes,
    };
  });

  const { data: created, error } = await supabase
    .from("lessons")
    .insert(rows)
    .select("id");

  if (error || !created?.length) {
    return { error: error?.message ?? "Erro ao agendar" };
  }

  revalidatePath("/agenda");
  revalidatePath(`/pacotes/${packageId}`);
  redirect(`/pacotes/${packageId}`);
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
