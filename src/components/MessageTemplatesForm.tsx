"use client";

import { useState, useTransition } from "react";
import {
  DEFAULT_MSG_COMPLETED,
  DEFAULT_MSG_MISSED,
  DEFAULT_MSG_PAYMENT_REMINDER,
  DEFAULT_MSG_RENEWAL,
  DEFAULT_MSG_RESCHEDULED,
} from "@/lib/messages/templates";
import {
  resetMessageTemplates,
  updateMessageTemplates,
} from "@/lib/messages/actions";

type Props = {
  initial: {
    msg_completed: string | null;
    msg_missed: string | null;
    msg_rescheduled: string | null;
    msg_renewal: string | null;
    msg_payment_reminder: string | null;
    msg_signature: string | null;
    msg_signature_enabled: boolean;
  };
};

const fields = [
  {
    name: "msg_completed" as const,
    title: "Aula dada",
    hint: "Variáveis: {aluno} {n} {total} {data} {restantes}",
    defaultValue: DEFAULT_MSG_COMPLETED,
  },
  {
    name: "msg_missed" as const,
    title: "Aula não dada",
    hint: "Variáveis: {aluno} {data}",
    defaultValue: DEFAULT_MSG_MISSED,
  },
  {
    name: "msg_rescheduled" as const,
    title: "Aula remarcada",
    hint: "Variáveis: {aluno} {data_antiga} {data_nova}",
    defaultValue: DEFAULT_MSG_RESCHEDULED,
  },
  {
    name: "msg_renewal" as const,
    title: "Renovação (última aula do pacote)",
    hint: "Variáveis: {aluno} {total} {pacote} {data}",
    defaultValue: DEFAULT_MSG_RENEWAL,
  },
  {
    name: "msg_payment_reminder" as const,
    title: "Lembrete de pagamento",
    hint: "Variáveis: {aluno} {pacote} {valor} {valor_pago} {faltante} {data_prevista} {status}",
    defaultValue: DEFAULT_MSG_PAYMENT_REMINDER,
  },
];

export function MessageTemplatesForm({ initial }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [signatureEnabled, setSignatureEnabled] = useState(
    initial.msg_signature_enabled,
  );
  const [signature, setSignature] = useState(initial.msg_signature ?? "");
  const [values, setValues] = useState({
    msg_completed: initial.msg_completed ?? DEFAULT_MSG_COMPLETED,
    msg_missed: initial.msg_missed ?? DEFAULT_MSG_MISSED,
    msg_rescheduled: initial.msg_rescheduled ?? DEFAULT_MSG_RESCHEDULED,
    msg_renewal: initial.msg_renewal ?? DEFAULT_MSG_RENEWAL,
    msg_payment_reminder:
      initial.msg_payment_reminder ?? DEFAULT_MSG_PAYMENT_REMINDER,
  });

  function onSave(formData: FormData) {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updateMessageTemplates(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSaved(true);
    });
  }

  function onReset() {
    if (!confirm("Restaurar as mensagens padrão e desativar a assinatura?")) {
      return;
    }
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await resetMessageTemplates();
      if (result.error) {
        setError(result.error);
        return;
      }
      setValues({
        msg_completed: DEFAULT_MSG_COMPLETED,
        msg_missed: DEFAULT_MSG_MISSED,
        msg_rescheduled: DEFAULT_MSG_RESCHEDULED,
        msg_renewal: DEFAULT_MSG_RENEWAL,
        msg_payment_reminder: DEFAULT_MSG_PAYMENT_REMINDER,
      });
      setSignatureEnabled(false);
      setSignature("");
      setSaved(true);
    });
  }

  return (
    <form action={onSave} className="space-y-5">
      {fields.map((field) => (
        <label
          key={field.name}
          className="panel block space-y-2 p-4 text-sm font-medium text-[var(--ink-muted)]"
        >
          <span className="block text-base font-semibold text-[var(--ink)]">
            {field.title}
          </span>
          <span className="block text-xs font-normal">{field.hint}</span>
          <textarea
            name={field.name}
            rows={4}
            value={values[field.name]}
            onChange={(e) =>
              setValues((prev) => ({ ...prev, [field.name]: e.target.value }))
            }
            className="input mt-1 font-normal"
          />
        </label>
      ))}

      <div className="panel space-y-3 p-4">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            name="msg_signature_enabled"
            checked={signatureEnabled}
            onChange={(e) => setSignatureEnabled(e.target.checked)}
            className="mt-1"
          />
          <span>
            <span className="block text-base font-semibold text-[var(--ink)]">
              Assinatura
            </span>
            <span className="text-sm text-[var(--ink-muted)]">
              Se ativada, este texto é adicionado no final de todas as mensagens.
            </span>
          </span>
        </label>
        {signatureEnabled && (
          <label className="block text-sm font-medium text-[var(--ink-muted)]">
            Texto da assinatura
            <textarea
              name="msg_signature"
              rows={3}
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              placeholder={"Atenciosamente,\nProf. Nome"}
              className="input mt-1 font-normal"
            />
          </label>
        )}
        {!signatureEnabled && (
          <input type="hidden" name="msg_signature" value={signature} />
        )}
      </div>

      {error && (
        <p className="form-error">
          {error}
        </p>
      )}
      {saved && !error && (
        <p className="rounded-lg bg-[var(--success-soft)] px-3 py-2 text-sm text-[var(--success)]">
          Mensagens salvas.
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <button type="submit" disabled={pending} className="btn-primary flex-1">
          {pending ? "Salvando..." : "Salvar mensagens"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={onReset}
          className="btn-secondary flex-1"
        >
          Restaurar padrão
        </button>
      </div>
    </form>
  );
}
