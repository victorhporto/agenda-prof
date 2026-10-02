import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadRearrangeContext } from "@/lib/assistente/load";
import { parseRearrangeInput } from "@/lib/assistente/rearrange";
import { buildRearrangePrompt, parseChatTurns } from "@/lib/assistente/prompt";
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
  const parsed = parseRearrangeInput(payload.context);
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

  const loaded = await loadRearrangeContext(supabase, user.id, parsed.value);
  if ("error" in loaded) {
    return NextResponse.json({ error: loaded.error }, { status: 400 });
  }

  return streamAssistantReply(
    buildRearrangePrompt({
      teacherWindows: parsed.value.teacherWindows,
      ...loaded.data,
    }),
    turns,
  );
}
