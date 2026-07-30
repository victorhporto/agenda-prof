"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
