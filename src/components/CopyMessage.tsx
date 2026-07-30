"use client";

import { useState } from "react";

export function CopyMessage({ message }: { message: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <p className="mb-3 whitespace-pre-wrap text-sm leading-relaxed text-[var(--ink)]">
        {message}
      </p>
      <button
        type="button"
        onClick={handleCopy}
        className="btn-secondary w-full sm:w-auto"
      >
        {copied ? "Copiado!" : "Copiar mensagem"}
      </button>
    </div>
  );
}
