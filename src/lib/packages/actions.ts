"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { syncPackagePaymentTotals } from "@/lib/payments/actions";
import { saoPauloInputToIso, todayYmdSaoPaulo } from "@/lib/timezone";
import { findScheduleConflicts } from "@/lib/lessons/conflicts";

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
  if (price != null && (!Number.isFinite(price) || price < 0)) {
    return { error: "Valor inválido" };
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

  if (initialPaid > 0) {
    await supabase.from("payment_entries").insert({
      package_id: data.id,
      teacher_id: user.id,
      amount: initialPaid,
      paid_at: todayYmdSaoPaulo(),
      notes: "Pagamento na criação do pacote",
    });
  }

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
  if (recurrence !== "once" && recurrence !== "weekly" && recurrence !== "biweekly") {
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

  const count = recurrence === "once" ? 1 : remainingSlots;
  const stepDays = recurrence === "biweekly" ? 14 : 7;
  const startIso = saoPauloInputToIso(scheduledAt);
  if (!startIso) {
    return { error: "Data inválida" };
  }
  const start = new Date(startIso);

  const rows = Array.from({ length: count }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(date.getUTCDate() + index * stepDays);
    return {
      teacher_id: user.id,
      package_id: packageId,
      scheduled_at: date.toISOString(),
      status: "scheduled" as const,
      notes,
    };
  });

  const conflict = await findScheduleConflicts(
    supabase,
    user.id,
    rows.map((r) => r.scheduled_at),
  );
  if (conflict) {
    return { error: conflict.message };
  }

  const { data: created, error } = await supabase
    .from("lessons")
    .insert(rows)
    .select("id");

  if (error || !created?.length) {
    return { error: error?.message ?? "Erro ao agendar" };
  }

  revalidatePath("/agenda");
  revalidatePath("/inicio");
  revalidatePath("/pacotes");
  revalidatePath(`/pacotes/${packageId}`);
  redirect(`/pacotes/${packageId}`);
}

export async function closePackage(
  packageId: string,
  options?: { cancelScheduled?: boolean },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  if (options?.cancelScheduled) {
    const { error: cancelError } = await supabase
      .from("lessons")
      .update({ status: "cancelled" })
      .eq("package_id", packageId)
      .eq("teacher_id", user.id)
      .eq("status", "scheduled");

    if (cancelError) return { error: cancelError.message };
  }

  const { error } = await supabase
    .from("lesson_packages")
    .update({ status: "closed" })
    .eq("id", packageId)
    .eq("teacher_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/pacotes");
  revalidatePath("/inicio");
  revalidatePath("/agenda");
  revalidatePath(`/pacotes/${packageId}`);
  return { success: true };
}

export async function updatePackage(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const packageId = String(formData.get("package_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const totalLessons = Number(formData.get("total_lessons"));
  const priceRaw = String(formData.get("price") ?? "").trim();
  const price = priceRaw === "" ? null : Number(priceRaw);

  if (!packageId) return { error: "Pacote inválido" };
  if (!title) return { error: "Título é obrigatório" };
  if (!Number.isFinite(totalLessons) || totalLessons < 1) {
    return { error: "Total de aulas deve ser pelo menos 1" };
  }
  if (price != null && (!Number.isFinite(price) || price < 0)) {
    return { error: "Valor inválido" };
  }

  const { data: pkg, error: pkgError } = await supabase
    .from("lesson_packages")
    .select("id, total_lessons")
    .eq("id", packageId)
    .eq("teacher_id", user.id)
    .single();

  if (pkgError || !pkg) return { error: "Pacote não encontrado" };

  const { data: lessons } = await supabase
    .from("lessons")
    .select("status")
    .eq("package_id", packageId);

  const completed = (lessons ?? []).filter((l) => l.status === "completed")
    .length;
  const scheduled = (lessons ?? []).filter((l) => l.status === "scheduled")
    .length;

  if (totalLessons < completed) {
    return {
      error: `Total não pode ser menor que as ${completed} aulas já dadas`,
    };
  }

  if (totalLessons < completed + scheduled) {
    return {
      error: `Total não pode ser menor que dadas + agendadas (${completed + scheduled})`,
    };
  }

  const { error } = await supabase
    .from("lesson_packages")
    .update({
      title,
      total_lessons: totalLessons,
      price,
    })
    .eq("id", packageId)
    .eq("teacher_id", user.id);

  if (error) return { error: error.message };

  const sync = await syncPackagePaymentTotals(supabase, packageId, user.id);
  if (sync.error) return { error: sync.error };

  revalidatePath("/pacotes");
  revalidatePath("/faturamento");
  revalidatePath("/inicio");
  revalidatePath(`/pacotes/${packageId}`);
  return { success: true as const };
}

export async function reopenPackage(packageId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const { data: pkg, error: pkgError } = await supabase
    .from("lesson_packages")
    .select("id, status, total_lessons")
    .eq("id", packageId)
    .eq("teacher_id", user.id)
    .single();

  if (pkgError || !pkg) return { error: "Pacote não encontrado" };
  if (pkg.status !== "closed") {
    return { error: "Pacote já está ativo" };
  }

  const { data: lessons } = await supabase
    .from("lessons")
    .select("status")
    .eq("package_id", packageId);

  const completed = (lessons ?? []).filter((l) => l.status === "completed")
    .length;
  if (completed >= pkg.total_lessons) {
    return {
      error:
        "Todas as aulas do pacote já foram dadas. Aumente o total de aulas antes de reabrir.",
    };
  }

  const { error } = await supabase
    .from("lesson_packages")
    .update({ status: "active" })
    .eq("id", packageId)
    .eq("teacher_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/pacotes");
  revalidatePath("/inicio");
  revalidatePath("/agenda");
  revalidatePath(`/pacotes/${packageId}`);
  return { success: true as const };
}
