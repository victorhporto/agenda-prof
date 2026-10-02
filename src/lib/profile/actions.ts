"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseTeacherWindows } from "@/lib/assistente/occupancy";
import { resolveAddress } from "@/lib/geo/geocode";
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

export async function updateBaseAddress(raw: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Faça login novamente." };

  const { data: previous } = await supabase
    .from("profiles")
    .select("base_address, base_lat, base_lng")
    .eq("id", user.id)
    .maybeSingle();
  const resolved = await resolveAddress(
    raw,
    previous
      ? {
          address: previous.base_address,
          lat: previous.base_lat,
          lng: previous.base_lng,
        }
      : null,
  );

  const { error } = await supabase
    .from("profiles")
    .update({
      base_address: resolved.address,
      base_lat: resolved.lat,
      base_lng: resolved.lng,
    })
    .eq("id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/perfil");
  revalidatePath("/assistente");
  revalidatePath("/agenda");
  return {
    ok: true as const,
    located: resolved.address == null || resolved.lat != null,
  };
}
