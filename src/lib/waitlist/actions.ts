"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseRequiredLocation } from "@/lib/lessons/location";
import { parseStudentSlots } from "@/lib/assistente/occupancy";
import type { Json } from "@/lib/database.types";

function parseWaitlistInput(raw: {
  name?: unknown;
  contact?: unknown;
  location?: unknown;
  slots?: unknown;
}) {
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  const contact = typeof raw.contact === "string" ? raw.contact.trim() : "";
  const location = parseRequiredLocation(raw.location);
  const slots = parseStudentSlots(raw.slots);

  if (!name) return { ok: false as const, error: "Nome é obrigatório" };
  if (!contact) return { ok: false as const, error: "Informe um contato" };
  if (!location) {
    return { ok: false as const, error: "Selecione a preferência de local" };
  }
  if (!slots.ok) return slots;

  return {
    ok: true as const,
    value: {
      name,
      contact,
      location,
      available_slots: slots.value as Json,
    },
  };
}

export async function createWaitlistEntry(raw: {
  name: string;
  contact: string;
  location: unknown;
  slots: unknown;
}) {
  const parsed = parseWaitlistInput(raw);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const { error } = await supabase.from("waitlist_entries").insert({
    teacher_id: user.id,
    ...parsed.value,
  });

  if (error) return { error: error.message };

  revalidatePath("/fila");
  return { success: true as const };
}

export async function updateWaitlistEntry(
  id: string,
  raw: {
    name: string;
    contact: string;
    location: unknown;
    slots: unknown;
  },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };
  if (!id) return { error: "Item da fila inválido" };

  const parsed = parseWaitlistInput(raw);
  if (!parsed.ok) return { error: parsed.error };

  const { error } = await supabase
    .from("waitlist_entries")
    .update(parsed.value)
    .eq("id", id)
    .eq("teacher_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/fila");
  return { success: true as const };
}

export async function deleteWaitlistEntry(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };
  if (!id) return { error: "Item da fila inválido" };

  const { error } = await supabase
    .from("waitlist_entries")
    .delete()
    .eq("id", id)
    .eq("teacher_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/fila");
  return { success: true as const };
}
