"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseRequiredLocation } from "@/lib/lessons/location";
import { resolveAddressParts } from "@/lib/geo/geocode";
import { addressPartsFromFormData, parseAddressParts } from "@/lib/geo/address";
import type { Json } from "@/lib/database.types";

export async function createStudent(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const defaultLocation = parseRequiredLocation(formData.get("default_location"));

  if (!name) return { error: "Nome é obrigatório" };
  if (!defaultLocation) return { error: "Selecione o local padrão das aulas" };
  const parts = parseAddressParts(addressPartsFromFormData(formData));
  if (!parts.ok) return { error: parts.error };

  const address = await resolveAddressParts(parts.value);
  const { error } = await supabase.from("students").insert({
    teacher_id: user.id,
    name,
    phone,
    notes,
    default_location: defaultLocation,
    ...address,
    address_parts: parts.value as Json | null,
  });

  if (error) return { error: error.message };

  revalidatePath("/alunos");
  revalidatePath("/assistente");
  return { success: true };
}

export async function updateStudent(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const defaultLocation = parseRequiredLocation(formData.get("default_location"));

  if (!id) return { error: "Aluno inválido" };
  if (!name) return { error: "Nome é obrigatório" };
  if (!defaultLocation) return { error: "Selecione o local padrão das aulas" };
  const parts = parseAddressParts(addressPartsFromFormData(formData));
  if (!parts.ok) return { error: parts.error };

  const { data: previous } = await supabase
    .from("students")
    .select("address, lat, lng")
    .eq("id", id)
    .eq("teacher_id", user.id)
    .maybeSingle();
  const address = await resolveAddressParts(parts.value, previous);

  const { error } = await supabase
    .from("students")
    .update({
      name,
      phone,
      notes,
      default_location: defaultLocation,
      ...address,
      address_parts: parts.value as Json | null,
    })
    .eq("id", id)
    .eq("teacher_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/alunos");
  revalidatePath("/pacotes");
  revalidatePath("/agenda");
  revalidatePath("/assistente");
  return { success: true };
}

export async function deleteStudent(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const { error } = await supabase
    .from("students")
    .delete()
    .eq("id", id)
    .eq("teacher_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/alunos");
  revalidatePath("/pacotes");
  revalidatePath("/agenda");
  revalidatePath("/inicio");
  revalidatePath("/faturamento");
  return { success: true };
}
