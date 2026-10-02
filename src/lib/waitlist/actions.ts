"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseRequiredLocation } from "@/lib/lessons/location";
import { parseStudentSlots } from "@/lib/assistente/occupancy";
import { resolveAddressParts } from "@/lib/geo/geocode";
import { parseAddressParts } from "@/lib/geo/address";
import type { Json } from "@/lib/database.types";

type WaitlistRaw = {
  name?: unknown;
  contact?: unknown;
  location?: unknown;
  slots?: unknown;
  address?: unknown;
};

function parseWaitlistInput(raw: WaitlistRaw) {
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
  const address = parseAddressParts(raw.address);
  if (!address.ok) return address;

  return {
    ok: true as const,
    address: address.value,
    value: {
      name,
      contact,
      location,
      available_slots: slots.value as Json,
      address_parts: address.value as Json | null,
    },
  };
}

export async function createWaitlistEntry(raw: WaitlistRaw) {
  const parsed = parseWaitlistInput(raw);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const address = await resolveAddressParts(parsed.address);
  const { error } = await supabase.from("waitlist_entries").insert({
    teacher_id: user.id,
    ...parsed.value,
    ...address,
  });

  if (error) return { error: error.message };

  revalidatePath("/fila");
  return { success: true as const };
}

export async function updateWaitlistEntry(id: string, raw: WaitlistRaw) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };
  if (!id) return { error: "Item da fila inválido" };

  const parsed = parseWaitlistInput(raw);
  if (!parsed.ok) return { error: parsed.error };

  const { data: previous } = await supabase
    .from("waitlist_entries")
    .select("address, lat, lng")
    .eq("id", id)
    .eq("teacher_id", user.id)
    .maybeSingle();
  const address = await resolveAddressParts(parsed.address, previous);

  const { error } = await supabase
    .from("waitlist_entries")
    .update({ ...parsed.value, ...address })
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
