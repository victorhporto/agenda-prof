"use client";

import { useState } from "react";
import { whatsappUrl } from "@/lib/whatsapp";

export function CopyMessage({
  message,
  phone,
  title,
}: {
  message: string;
  phone?: string | null;
  title?: string;
}) {
  const [copied, setCopied] = useState(false);
  const waLink = whatsappUrl(phone ?? "", message);

  async function handleCopy() {
    await navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      {title && (
        <p className="mb-2 text-sm font-semibold text-[var(--ink-muted)]">
          {title}
        </p>
      )}
      <p className="mb-3 whitespace-pre-wrap text-sm leading-relaxed text-[var(--ink)]">
        {message}
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        {waLink ? (
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary w-full sm:w-auto"
          >
            Abrir no WhatsApp
          </a>
        ) : (
          <p className="text-sm text-[var(--ink-muted)] sm:self-center">
            Cadastre o WhatsApp do aluno para enviar direto.
          </p>
        )}
        <button
          type="button"
          onClick={handleCopy}
          className="btn-secondary w-full sm:w-auto"
        >
          {copied ? "Copiado!" : "Copiar mensagem"}
        </button>
      </div>
    </div>
  );
}
