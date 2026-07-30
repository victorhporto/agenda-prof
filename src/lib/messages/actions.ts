"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function updateMessageTemplates(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const msgCompleted = String(formData.get("msg_completed") ?? "").trim() || null;
  const msgMissed = String(formData.get("msg_missed") ?? "").trim() || null;
  const msgRescheduled =
    String(formData.get("msg_rescheduled") ?? "").trim() || null;
  const signatureEnabled = formData.get("msg_signature_enabled") === "on";
  const msgSignature =
    String(formData.get("msg_signature") ?? "").trim() || null;

  if (signatureEnabled && !msgSignature) {
    return { error: "Preencha o texto da assinatura ou desative a opção." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      msg_completed: msgCompleted,
      msg_missed: msgMissed,
      msg_rescheduled: msgRescheduled,
      msg_signature: msgSignature,
      msg_signature_enabled: signatureEnabled,
    })
    .eq("id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/mensagens");
  revalidatePath("/aulas");
  return { success: true };
}

export async function resetMessageTemplates() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const { error } = await supabase
    .from("profiles")
    .update({
      msg_completed: null,
      msg_missed: null,
      msg_rescheduled: null,
      msg_signature: null,
      msg_signature_enabled: false,
    })
    .eq("id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/mensagens");
  return { success: true };
}
