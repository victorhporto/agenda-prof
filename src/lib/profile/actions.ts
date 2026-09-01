"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseTeacherWindows } from "@/lib/assistente/occupancy";
import type { Json } from "@/lib/database.types";

export async function updateTeacherWindows(raw: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Faça login novamente." };

  const parsed = parseTeacherWindows(raw);
  if (!parsed.ok) return { error: parsed.error };

  const { error } = await supabase
    .from("profiles")
    .update({ teacher_windows: parsed.value as Json })
    .eq("id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/perfil");
  revalidatePath("/assistente");
  revalidatePath("/agenda");
  return { ok: true as const };
}
