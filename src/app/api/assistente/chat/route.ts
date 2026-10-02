import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadWeekOccupiedBlocks } from "@/lib/assistente/load";
import {
  findCandidateSlots,
  parseAssistenteFormInput,
} from "@/lib/assistente/occupancy";
import { buildSystemPrompt, parseChatTurns } from "@/lib/assistente/prompt";
import {
  assistantApiKeyMissing,
  streamAssistantReply,
} from "@/lib/assistente/openai-stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const missingKey = assistantApiKeyMissing();
  if (missingKey) return missingKey;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const payload = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const parsed = parseAssistenteFormInput(payload.context);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const turns = parseChatTurns(payload.messages);
  if (turns.length === 0) {
    return NextResponse.json(
      { error: "Envie pelo menos uma mensagem" },
      { status: 400 },
    );
  }

  let loaded: Awaited<ReturnType<typeof loadWeekOccupiedBlocks>>;
  try {
    loaded = await loadWeekOccupiedBlocks(supabase, user.id);
  } catch {
    return NextResponse.json(
      { error: "Não foi possível ler a agenda desta semana" },
      { status: 500 },
    );
  }

  const { occupied, weekLabel, base } = loaded;
  const candidates = findCandidateSlots({
    studentSlots: parsed.value.studentSlots,
    teacherWindows: parsed.value.teacherWindows,
    occupied,
    location: parsed.value.location,
    base,
  });

  return streamAssistantReply(
    buildSystemPrompt({
      form: parsed.value,
      occupied,
      candidates,
      weekLabel,
      hasBase: base.coords != null,
    }),
    turns,
  );
}
