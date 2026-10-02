"use server";

import { createClient } from "@/lib/supabase/server";
import {
  loadRearrangeContext,
  loadWeekOccupiedBlocks,
  type RearrangeContext,
} from "@/lib/assistente/load";
import { parseRearrangeInput } from "@/lib/assistente/rearrange";
import {
  findCandidateSlots,
  parseAssistenteFormInput,
  type CandidateSlot,
  type OccupiedBlock,
} from "@/lib/assistente/occupancy";

export type AssistentePreview = {
  weekLabel: string;
  occupied: OccupiedBlock[];
  candidates: CandidateSlot[];
};

export async function previewAssistenteContext(
  raw: unknown,
): Promise<{ data: AssistentePreview } | { error: string }> {
  const parsed = parseAssistenteFormInput(raw);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  try {
    const { occupied, weekLabel } = await loadWeekOccupiedBlocks(
      supabase,
      user.id,
    );
    const candidates = findCandidateSlots({
      studentSlots: parsed.value.studentSlots,
      teacherWindows: parsed.value.teacherWindows,
      occupied,
      location: parsed.value.location,
    });

    return { data: { weekLabel, occupied, candidates } };
  } catch {
    return { error: "Não foi possível ler a agenda desta semana" };
  }
}

export async function previewRearrangeContext(
  raw: unknown,
): Promise<{ data: RearrangeContext } | { error: string }> {
  const parsed = parseRearrangeInput(raw);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  return loadRearrangeContext(supabase, user.id, parsed.value);
}
