"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { paymentReminderMessage } from "@/lib/messages/templates";
import { packageBalance } from "@/lib/utils";
import { todayYmdSaoPaulo } from "@/lib/timezone";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

export async function syncPackagePaymentTotals(
  supabase: ServerClient,
  packageId: string,
  teacherId: string,
) {
  const { data: pkg } = await supabase
    .from("lesson_packages")
    .select("id, price")
    .eq("id", packageId)
    .eq("teacher_id", teacherId)
    .single();

  if (!pkg) return { error: "Pacote não encontrado" };

  const { data: entries } = await supabase
    .from("payment_entries")
    .select("amount")
    .eq("package_id", packageId)
    .eq("teacher_id", teacherId);

  const amountPaid = (entries ?? []).reduce(
    (sum, entry) => sum + Number(entry.amount),
    0,
  );
  const price = Number(pkg.price ?? 0);

  let paymentStatus: "pending" | "partial" | "paid" = "pending";
  let paidAt: string | null = null;

  if (amountPaid <= 0) {
    paymentStatus = "pending";
  } else if (price > 0 && amountPaid >= price) {
    paymentStatus = "paid";
    paidAt = new Date().toISOString();
  } else if (price <= 0 && amountPaid > 0) {
    paymentStatus = "paid";
    paidAt = new Date().toISOString();
  } else {
    paymentStatus = "partial";
  }

  const { error } = await supabase
    .from("lesson_packages")
    .update({
      amount_paid: amountPaid,
      payment_status: paymentStatus,
      paid_at: paidAt,
    })
    .eq("id", packageId)
    .eq("teacher_id", teacherId);

  if (error) return { error: error.message };
  return { success: true as const, amountPaid, paymentStatus };
}

function revalidatePaymentPaths(packageId: string) {
  revalidatePath("/faturamento");
  revalidatePath("/pacotes");
  revalidatePath("/inicio");
  revalidatePath(`/pacotes/${packageId}`);
}

export async function updatePackagePaymentMeta(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const packageId = String(formData.get("package_id") ?? "");
  const notes = String(formData.get("payment_notes") ?? "").trim() || null;
  const paymentDueDate =
    String(formData.get("payment_due_date") ?? "").trim() || null;

  if (!packageId) return { error: "Pacote obrigatório" };

  const { error } = await supabase
    .from("lesson_packages")
    .update({
      payment_notes: notes,
      payment_due_date: paymentDueDate,
    })
    .eq("id", packageId)
    .eq("teacher_id", user.id);

  if (error) return { error: error.message };

  revalidatePaymentPaths(packageId);
  return { success: true };
}

export async function addPaymentEntry(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const packageId = String(formData.get("package_id") ?? "");
  const amount = Number(String(formData.get("amount") ?? "").trim());
  const paidAt =
    String(formData.get("paid_at") ?? "").trim() || todayYmdSaoPaulo();
  const method = String(formData.get("method") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!packageId) return { error: "Pacote obrigatório" };
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "Informe um valor maior que zero" };
  }

  const { data: pkg } = await supabase
    .from("lesson_packages")
    .select("id")
    .eq("id", packageId)
    .eq("teacher_id", user.id)
    .single();

  if (!pkg) return { error: "Pacote não encontrado" };

  const { error } = await supabase.from("payment_entries").insert({
    package_id: packageId,
    teacher_id: user.id,
    amount,
    paid_at: paidAt,
    method,
    notes,
  });

  if (error) return { error: error.message };

  const sync = await syncPackagePaymentTotals(supabase, packageId, user.id);
  if (sync.error) return { error: sync.error };

  revalidatePaymentPaths(packageId);
  return { success: true };
}

export async function deletePaymentEntry(entryId: string, packageId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const { error } = await supabase
    .from("payment_entries")
    .delete()
    .eq("id", entryId)
    .eq("teacher_id", user.id);

  if (error) return { error: error.message };

  const sync = await syncPackagePaymentTotals(supabase, packageId, user.id);
  if (sync.error) return { error: sync.error };

  revalidatePaymentPaths(packageId);
  return { success: true };
}

export async function markPackagePaid(packageId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const { data: pkg, error: pkgError } = await supabase
    .from("lesson_packages")
    .select("id, price, amount_paid")
    .eq("id", packageId)
    .eq("teacher_id", user.id)
    .single();

  if (pkgError || !pkg) return { error: "Pacote não encontrado" };

  const remaining = Math.max(
    Number(pkg.price ?? 0) - Number(pkg.amount_paid ?? 0),
    0,
  );

  if (remaining > 0) {
    const { error } = await supabase.from("payment_entries").insert({
      package_id: packageId,
      teacher_id: user.id,
      amount: remaining,
      paid_at: todayYmdSaoPaulo(),
      notes: "Quitação do pacote",
    });
    if (error) return { error: error.message };

    const sync = await syncPackagePaymentTotals(supabase, packageId, user.id);
    if (sync.error) return { error: sync.error };
  } else {
    // Pacote sem valor restante (gratuito ou já coberto) — marca pago mesmo assim.
    const { error } = await supabase
      .from("lesson_packages")
      .update({
        payment_status: "paid",
        paid_at: new Date().toISOString(),
        amount_paid: Number(pkg.amount_paid ?? 0),
      })
      .eq("id", packageId)
      .eq("teacher_id", user.id);
    if (error) return { error: error.message };
  }

  revalidatePaymentPaths(packageId);
  return { success: true };
}

export async function buildPaymentReminder(packageId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const { data: pkg, error } = await supabase
    .from("lesson_packages")
    .select(
      `
      id,
      title,
      price,
      amount_paid,
      payment_status,
      payment_due_date,
      students ( name, phone )
    `,
    )
    .eq("id", packageId)
    .eq("teacher_id", user.id)
    .single();

  if (error || !pkg) return { error: "Pacote não encontrado" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("msg_payment_reminder, msg_signature, msg_signature_enabled")
    .eq("id", user.id)
    .single();

  const student = pkg.students as {
    name: string;
    phone: string | null;
  } | null;
  const balance = packageBalance(pkg);

  const message = paymentReminderMessage(
    {
      studentName: student?.name ?? "aluno",
      packageTitle: pkg.title,
      price: pkg.price,
      amountPaid: balance.paid,
      dueAmount: balance.due,
      paymentDueDate: pkg.payment_due_date,
      paymentStatus: pkg.payment_status,
    },
    profile?.msg_payment_reminder,
    {
      enabled: profile?.msg_signature_enabled ?? false,
      text: profile?.msg_signature ?? null,
    },
  );

  return {
    message,
    phone: student?.phone ?? null,
  };
}
