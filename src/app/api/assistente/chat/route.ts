import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import { loadWeekOccupiedBlocks } from "@/lib/assistente/load";
import {
  findCandidateSlots,
  parseAssistenteFormInput,
} from "@/lib/assistente/occupancy";
import { buildSystemPrompt, parseChatTurns } from "@/lib/assistente/prompt";

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

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Assistente não configurado. Adicione OPENAI_API_KEY." },
      { status: 503 },
    );
  }

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

  let occupied: Awaited<ReturnType<typeof loadWeekOccupiedBlocks>>["occupied"];
  let weekLabel: string;
  try {
    const loaded = await loadWeekOccupiedBlocks(supabase, user.id);
    occupied = loaded.occupied;
    weekLabel = loaded.weekLabel;
  } catch {
    return NextResponse.json(
      { error: "Não foi possível ler a agenda desta semana" },
      { status: 500 },
    );
  }

  const candidates = findCandidateSlots({
    studentSlots: parsed.value.studentSlots,
    teacherWindows: parsed.value.teacherWindows,
    occupied,
    location: parsed.value.location,
  });

  const openai = new OpenAI({ apiKey });
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  let stream: Awaited<ReturnType<typeof openai.chat.completions.create>>;
  try {
    stream = await openai.chat.completions.create({
      model,
      temperature: 0.3,
      stream: true as const,
      messages: [
        {
          role: "system",
          content: buildSystemPrompt({
            form: parsed.value,
            occupied,
            candidates,
            weekLabel,
          }),
        },
        ...turns.map((turn) => ({
          role: turn.role,
          content: turn.content,
        })),
      ],
    });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível falar com o assistente. Tente de novo." },
      { status: 502 },
    );
  }

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content;
          if (delta) controller.enqueue(encoder.encode(delta));
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
