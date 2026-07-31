"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function updateNotifyEmail(enabled: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Faça login novamente." };

  const { error } = await supabase
    .from("profiles")
    .update({ notify_email: enabled })
    .eq("id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/mensagens");
  return { ok: true as const };
}
