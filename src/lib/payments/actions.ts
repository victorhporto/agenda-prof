"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { paymentReminderMessage } from "@/lib/messages/templates";
import { packageBalance } from "@/lib/utils";

export async function updatePackagePayment(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const packageId = String(formData.get("package_id") ?? "");
  const paymentStatus = String(formData.get("payment_status") ?? "pending");
  const amountRaw = String(formData.get("amount_paid") ?? "").trim();
  const notes = String(formData.get("payment_notes") ?? "").trim() || null;
  const paymentDueDate =
    String(formData.get("payment_due_date") ?? "").trim() || null;
  const amountPaid = amountRaw ? Number(amountRaw) : 0;

  if (!packageId) return { error: "Pacote obrigatório" };
  if (!["pending", "partial", "paid"].includes(paymentStatus)) {
    return { error: "Status de pagamento inválido" };
  }
  if (!Number.isFinite(amountPaid) || amountPaid < 0) {
    return { error: "Valor pago inválido" };
  }

  const { data: pkg, error: pkgError } = await supabase
    .from("lesson_packages")
    .select("id, price")
    .eq("id", packageId)
    .eq("teacher_id", user.id)
    .single();

  if (pkgError || !pkg) return { error: "Pacote não encontrado" };

  const price = Number(pkg.price ?? 0);
  let finalAmount = amountPaid;
  let finalStatus = paymentStatus;
  let paidAt: string | null = null;

  if (paymentStatus === "paid") {
    finalAmount = amountPaid > 0 ? amountPaid : price;
    paidAt = new Date().toISOString();
  } else if (paymentStatus === "partial") {
    if (finalAmount <= 0) {
      return { error: "Informe o valor já pago no pagamento parcial" };
    }
    if (price > 0 && finalAmount >= price) {
      finalStatus = "paid";
      paidAt = new Date().toISOString();
    }
  } else {
    finalAmount = 0;
    paidAt = null;
  }

  const { error } = await supabase
    .from("lesson_packages")
    .update({
      payment_status: finalStatus,
      amount_paid: finalAmount,
      paid_at: paidAt,
      payment_notes: notes,
      payment_due_date: paymentDueDate,
    })
    .eq("id", packageId)
    .eq("teacher_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/faturamento");
  revalidatePath("/pacotes");
  revalidatePath(`/pacotes/${packageId}`);
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
    .select("id, price")
    .eq("id", packageId)
    .eq("teacher_id", user.id)
    .single();

  if (pkgError || !pkg) return { error: "Pacote não encontrado" };

  const { error } = await supabase
    .from("lesson_packages")
    .update({
      payment_status: "paid",
      amount_paid: Number(pkg.price ?? 0),
      paid_at: new Date().toISOString(),
    })
    .eq("id", packageId)
    .eq("teacher_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/faturamento");
  revalidatePath("/pacotes");
  revalidatePath(`/pacotes/${packageId}`);
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
