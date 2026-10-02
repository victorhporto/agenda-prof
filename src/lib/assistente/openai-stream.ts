import { NextResponse } from "next/server";
import OpenAI from "openai";
import type { ChatTurn } from "@/lib/assistente/prompt";

export function assistantApiKeyMissing() {
  if (process.env.OPENAI_API_KEY) return null;
  return NextResponse.json(
    { error: "Assistente não configurado. Adicione OPENAI_API_KEY." },
    { status: 503 },
  );
}

export async function streamAssistantReply(
  systemPrompt: string,
  turns: ChatTurn[],
): Promise<Response> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  let stream: Awaited<ReturnType<typeof openai.chat.completions.create>>;
  try {
    stream = await openai.chat.completions.create({
      model,
      temperature: 0.3,
      stream: true as const,
      messages: [
        { role: "system", content: systemPrompt },
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
