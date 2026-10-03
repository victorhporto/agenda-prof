"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { previewRearrangeContext } from "@/lib/assistente/actions";
import type { RearrangeContext } from "@/lib/assistente/load";
import {
  LOCATION_SHORT,
  WEEKDAY_SHORT,
  summarizeTeacherWindows,
  type StudentSlot,
  type TeacherWindow,
} from "@/lib/assistente/occupancy";
import {
  MAX_REARRANGE_STUDENTS,
  parseRearrangeInput,
  rangeForLesson,
  type AvailabilityRange,
  type RearrangeInput,
  type WeekTravel,
} from "@/lib/assistente/rearrange";
import { formatMinutesLabel } from "@/lib/assistente/free-hours";
import { formatKm } from "@/lib/geo/travel";
import { AvailabilityRangesEditor } from "@/components/AvailabilityRangesEditor";
import {
  ChatComposer,
  ChatThread,
  streamAssistantChat,
  type ChatMessage,
} from "@/components/AssistenteChat";
import type { LessonLocation } from "@/lib/lessons/location";

export type WeekStudent = {
  id: string;
  name: string;
  location: LessonLocation | null;
  lessons: StudentSlot[];
  /** Sem aulas a partir de hoje: horário veio da semana anterior. */
  projected: boolean;
};

const FIRST_USER_MESSAGE =
  "Monte a melhor nova grade para os alunos selecionados. Não altere a agenda — só sugira.";

function formatSlots(slots: { weekday: StudentSlot["weekday"]; time: string }[]) {
  return slots.map((slot) => `${WEEKDAY_SHORT[slot.weekday]} ${slot.time}`).join(" · ");
}

function formatWeekTravel(travel: WeekTravel) {
  const km = travel.km > 0 ? ` (${formatKm(travel.km)})` : "";
  return `${formatMinutesLabel(travel.minutes)}${km}`;
}

export function RemanejarClient({
  weekStudents,
  teacherWindows,
  weekLabel,
  previousWeekLabel,
}: {
  weekStudents: WeekStudent[];
  teacherWindows: TeacherWindow[];
  weekLabel: string;
  previousWeekLabel: string;
}) {
  const [step, setStep] = useState<"form" | "chat">("form");
  const [availability, setAvailability] = useState<Record<string, AvailabilityRange[]>>({});
  const [released, setReleased] = useState<string[]>([]);
  const [context, setContext] = useState<RearrangeContext | null>(null);
  const [inputSnapshot, setInputSnapshot] = useState<RearrangeInput | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const selectedIds = weekStudents
    .map((student) => student.id)
    .filter((id) => id in availability);

  function toggleStudent(student: WeekStudent) {
    setReleased((ids) => ids.filter((id) => id !== student.id));
    setAvailability((current) => {
      if (student.id in current) {
        const next = { ...current };
        delete next[student.id];
        return next;
      }
      if (Object.keys(current).length >= MAX_REARRANGE_STUDENTS) return current;
      return { ...current, [student.id]: student.lessons.map(rangeForLesson) };
    });
  }

  async function streamReply(input: RearrangeInput, history: ChatMessage[]) {
    setStreaming(true);
    setError(null);
    await streamAssistantChat({
      endpoint: "/api/assistente/remanejar",
      context: input,
      history,
      onText: setMessages,
    });
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  async function onConfirm(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const parsed = parseRearrangeInput({
      students: selectedIds.map((studentId) => ({
        studentId,
        ranges: availability[studentId],
      })),
      teacherWindows,
      releasedStudentIds: released.filter((id) => !(id in availability)),
    });
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }

    setPending(true);
    try {
      const result = await previewRearrangeContext(parsed.value);
      if ("error" in result) {
        setError(result.error);
        return;
      }

      setInputSnapshot(parsed.value);
      setContext(result.data);
      setStep("chat");

      const history: ChatMessage[] = [{ role: "user", content: FIRST_USER_MESSAGE }];
      setMessages(history);
      await streamReply(parsed.value, history);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Não foi possível iniciar o assistente",
      );
    } finally {
      setPending(false);
      setStreaming(false);
    }
  }

  async function onSend(event: FormEvent) {
    event.preventDefault();
    if (!inputSnapshot || streaming || pending) return;
    const content = draft.trim();
    if (!content) return;

    const history: ChatMessage[] = [...messages, { role: "user", content }];
    setDraft("");
    setMessages(history);
    setPending(true);
    try {
      await streamReply(inputSnapshot, history);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Não foi possível enviar a mensagem",
      );
    } finally {
      setPending(false);
      setStreaming(false);
    }
  }

  function backToForm() {
    setStep("form");
    setMessages([]);
    setContext(null);
    setInputSnapshot(null);
    setError(null);
    setStreaming(false);
    setPending(false);
  }

  if (step === "chat" && context) {
    const { plan } = context;
    return (
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-[var(--ink)]">
              Remanejando {context.moving.length} aluno
              {context.moving.length === 1 ? "" : "s"}
            </p>
            <p className="text-sm text-[var(--ink-muted)]">
              Recorte da agenda: {context.weekLabel}
            </p>
          </div>
          <button type="button" className="btn-secondary px-3 py-2 text-sm" onClick={backToForm}>
            Voltar
          </button>
        </div>

        <div className="rounded-xl border border-[var(--accent)]/30 bg-[var(--accent-soft)] px-3 py-3 text-sm text-[var(--accent)]">
          Isto é uma sugestão — nada foi alterado na agenda. Remarque as aulas
          manualmente se gostar da proposta.
        </div>

        <div className="panel space-y-3 p-4 text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <p className="font-semibold">Grade calculada pelo sistema</p>
            <p className="text-[var(--ink-muted)]">
              {plan.placedLessons} de {plan.totalLessons} aulas encaixadas
            </p>
          </div>
          {plan.currentTravel.minutes > 0 || plan.proposedTravel.minutes > 0 ? (
            <p className="text-[var(--ink-muted)]">
              Deslocamento semanal estimado: {formatWeekTravel(plan.currentTravel)}{" "}
              → {formatWeekTravel(plan.proposedTravel)}
            </p>
          ) : null}
          <ul className="space-y-2">
            {plan.entries.map((entry) => {
              const student = context.moving.find(
                (item) => item.studentId === entry.studentId,
              );
              const current = student
                ? formatSlots(
                    student.current.map((block) => ({
                      weekday: block.weekday,
                      time: block.start,
                    })),
                  )
                : "";
              const proposed = entry.slots.length
                ? formatSlots(entry.slots)
                : "Sem horário";
              const unchanged =
                entry.missing === 0 && entry.keptCount === entry.slots.length;
              return (
                <li key={entry.studentId} className="rounded-xl bg-[var(--bg)] px-3 py-2">
                  <p className="font-medium">{entry.studentName}</p>
                  <p className="text-[var(--ink-muted)]">
                    {unchanged ? `Mantém ${current}` : `${current} → ${proposed}`}
                  </p>
                  {entry.missing > 0 ? (
                    <p className="text-[var(--warning)]">
                      Faltam {entry.missing} aula{entry.missing === 1 ? "" : "s"}:
                      nenhum horário informado cabe na grade.
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>

        <ChatThread
          messages={messages}
          hiddenFirstMessage={FIRST_USER_MESSAGE}
          streaming={streaming}
          bottomRef={bottomRef}
        />

        {error && <p className="form-error">{error}</p>}

        <ChatComposer
          draft={draft}
          onDraftChange={setDraft}
          onSubmit={onSend}
          busy={streaming || pending}
          streaming={streaming}
          placeholder="Ajuste: prefiro concentrar às terças, evite sexta..."
        />
      </div>
    );
  }

  if (weekStudents.length === 0) {
    return (
      <div className="panel p-8 text-center">
        <p className="font-medium">Nenhuma aula recente ou próxima</p>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          O remanejamento usa as aulas de {weekLabel} e, para quem ainda não
          renovou, as de {previousWeekLabel}. Agende aulas para poder
          trocar alunos de horário.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onConfirm} className="panel space-y-4 p-5">
      <div>
        <p className="text-sm font-medium text-[var(--ink)]">
          Quais alunos você quer trocar de horário?
        </p>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          Grade de {weekLabel}; quem ainda não tem aulas a partir de hoje entra
          com o horário de {previousWeekLabel}. Para cada aluno, informe as faixas em que
          ele pode ter aula (ex.: sexta das 10h às 15h + segunda das 13h às
          18h) — a aula atual já vem preenchida. Os demais alunos
          ficam onde estão.
        </p>
      </div>

      <ul className="space-y-3">
        {weekStudents.map((student) => {
          const selected = student.id in availability;
          return (
            <li
              key={student.id}
              className={`rounded-xl border p-3 ${
                selected
                  ? "border-[var(--accent)] bg-[var(--accent-soft)]/40"
                  : "border-[var(--border)]"
              }`}
            >
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => toggleStudent(student)}
                  className="mt-1"
                />
                <span>
                  <span className="block font-medium">{student.name}</span>
                  <span className="block text-sm text-[var(--ink-muted)]">
                    Hoje: {formatSlots(student.lessons)}
                    {student.location ? ` · ${LOCATION_SHORT[student.location]}` : ""}
                  </span>
                  {student.projected ? (
                    <span className="mt-1 inline-block rounded-full bg-[var(--warning-soft)] px-2 py-0.5 text-xs text-[var(--warning)]">
                      Pela semana passada · pacote sem aulas futuras
                    </span>
                  ) : null}
                </span>
              </label>
              {student.projected && !selected ? (
                <label className="mt-2 flex cursor-pointer items-center gap-2 pl-7 text-sm text-[var(--ink-muted)]">
                  <input
                    type="checkbox"
                    checked={released.includes(student.id)}
                    onChange={(event) =>
                      setReleased((ids) =>
                        event.target.checked
                          ? [...ids, student.id]
                          : ids.filter((id) => id !== student.id),
                      )
                    }
                  />
                  Não vai renovar — liberar este horário na análise
                </label>
              ) : null}
              {selected ? (
                <div className="mt-3 pl-7">
                  <AvailabilityRangesEditor
                    value={availability[student.id] ?? []}
                    onChange={(next) =>
                      setAvailability((current) => ({
                        ...current,
                        [student.id]: next,
                      }))
                    }
                  />
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4">
        <p className="text-sm font-medium text-[var(--ink)]">Seu horário</p>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          {summarizeTeacherWindows(teacherWindows)}
        </p>
        <p className="mt-2 text-sm">
          <Link
            href="/perfil"
            className="font-medium text-[var(--accent)] hover:underline"
          >
            Editar no perfil →
          </Link>
        </p>
      </div>

      {error && <p className="form-error">{error}</p>}

      <button
        type="submit"
        disabled={pending || selectedIds.length === 0}
        className="btn-primary w-full"
      >
        {pending
          ? "Lendo a agenda..."
          : selectedIds.length === 0
            ? "Selecione pelo menos um aluno"
            : `Remanejar ${selectedIds.length} aluno${selectedIds.length === 1 ? "" : "s"}`}
      </button>
    </form>
  );
}
