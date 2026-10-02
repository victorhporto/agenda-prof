"use client";

import type { FormEvent, RefObject } from "react";

export type ChatMessage = { role: "user" | "assistant"; content: string };

export async function streamAssistantChat({
  endpoint,
  context,
  history,
  onText,
}: {
  endpoint: string;
  context: unknown;
  history: ChatMessage[];
  onText: (messages: ChatMessage[]) => void;
}) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ context, messages: history }),
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(data?.error ?? "Falha ao falar com o assistente");
  }
  if (!response.body) {
    throw new Error("Resposta vazia do assistente");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  onText([...history, { role: "assistant", content: "" }]);

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
    onText([...history, { role: "assistant", content: text }]);
  }
}

export function ChatThread({
  messages,
  hiddenFirstMessage,
  streaming,
  bottomRef,
}: {
  messages: ChatMessage[];
  hiddenFirstMessage: string;
  streaming: boolean;
  bottomRef: RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className="space-y-3">
      {messages.map((message, index) => {
        if (
          index === 0 &&
          message.role === "user" &&
          message.content === hiddenFirstMessage
        ) {
          return null;
        }
        return (
          <div
            key={`${message.role}-${index}`}
            className={
              message.role === "user"
                ? "ml-6 rounded-2xl bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--ink)]"
                : "mr-6 panel px-4 py-3"
            }
          >
            {message.role === "user" ? (
              <p className="whitespace-pre-wrap">{message.content}</p>
            ) : (
              <AssistantMarkdown text={message.content} />
            )}
          </div>
        );
      })}
      {streaming && messages.at(-1)?.role !== "assistant" ? (
        <p className="text-sm text-[var(--ink-muted)]">Pensando...</p>
      ) : null}
      <div ref={bottomRef} />
    </div>
  );
}

export function ChatComposer({
  draft,
  onDraftChange,
  onSubmit,
  busy,
  streaming,
  placeholder,
}: {
  draft: string;
  onDraftChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  busy: boolean;
  streaming: boolean;
  placeholder: string;
}) {
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row">
      <input
        value={draft}
        onChange={(event) => onDraftChange(event.target.value)}
        placeholder={placeholder}
        className="input"
        disabled={busy}
      />
      <button
        type="submit"
        disabled={busy || !draft.trim()}
        className="btn-primary shrink-0"
      >
        {streaming ? "Enviando..." : "Enviar"}
      </button>
    </form>
  );
}

function AssistantMarkdown({ text }: { text: string }) {
  if (!text) {
    return (
      <p className="text-sm text-[var(--ink-muted)]">Pensando...</p>
    );
  }

  const blocks = text.split(/\n{2,}/);
  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {blocks.map((block, index) => {
        const lines = block.split("\n").filter((line) => line.trim() !== "");
        const isList = lines.length > 0 && lines.every((line) => /^\s*[-*]\s+/.test(line));
        if (isList) {
          return (
            <ul key={index} className="list-disc space-y-1 pl-5">
              {lines.map((line, lineIndex) => (
                <li key={lineIndex}>
                  {renderInline(line.replace(/^\s*[-*]\s+/, ""))}
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={index} className="whitespace-pre-wrap">
            {lines.map((line, lineIndex) => (
              <span key={lineIndex}>
                {lineIndex > 0 ? <br /> : null}
                {renderInline(line.replace(/^#{1,6}\s+/, ""))}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    return <span key={index}>{part}</span>;
  });
}
