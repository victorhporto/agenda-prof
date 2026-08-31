"use client";

import Link from "next/link";
import { useMemo, useRef, useState, type FormEvent } from "react";
import {
  previewAssistenteContext,
  type AssistentePreview,
} from "@/lib/assistente/actions";
import {
  LOCATION_LABELS,
  WEEKDAY_LABELS,
  WEEKDAYS,
  formatOccupiedLabel,
  parseAssistenteFormInput,
  summarizeTeacherWindows,
  type AssistenteFormInput,
  type StudentSlot,
  type TeacherWindow,
  type Weekday,
} from "@/lib/assistente/occupancy";
import { LocationRadios } from "@/components/LocationRadios";
import type { LessonLocation } from "@/lib/lessons/location";

type StudentOption = {
  id: string;
  name: string;
  defaultLocation: LessonLocation | null;
};

type ChatMessage = { role: "user" | "assistant"; content: string };

const FIRST_USER_MESSAGE =
  "Analise a grade e sugira o melhor encaixe para este aluno. Não altere a agenda — só sugira.";

function emptyStudentSlot(): StudentSlot {
  return { weekday: 1, time: "" };
}

export function AssistenteClient({
  students,
  initialTeacherWindows,
}: {
  students: StudentOption[];
  initialTeacherWindows: TeacherWindow[];
}) {
  const [step, setStep] = useState<"form" | "chat">("form");
  const [studentName, setStudentName] = useState("");
  const [lessonsPerWeek, setLessonsPerWeek] = useState(1);
  const [location, setLocation] = useState<LessonLocation>("online");
  const [studentSlots, setStudentSlots] = useState<StudentSlot[]>([
    emptyStudentSlot(),
  ]);
  const teacherWindows = initialTeacherWindows;
  const [preview, setPreview] = useState<AssistentePreview | null>(null);
  const [formSnapshot, setFormSnapshot] = useState<AssistenteFormInput | null>(
    null,
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const formValue = useMemo(
    () => ({
      studentName,
      lessonsPerWeek,
      location,
      studentSlots,
      teacherWindows,
    }),
    [studentName, lessonsPerWeek, location, studentSlots, teacherWindows],
  );

  async function streamReply(
    context: AssistenteFormInput,
    history: ChatMessage[],
  ) {
    setStreaming(true);
    setError(null);
    const response = await fetch("/api/assistente/chat", {
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
    setMessages([...history, { role: "assistant", content: "" }]);

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
      const snapshot = text;
      setMessages([...history, { role: "assistant", content: snapshot }]);
    }

    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  function updateStudentSlot(index: number, patch: Partial<StudentSlot>) {
    setStudentSlots((current) =>
      current.map((slot, itemIndex) =>
        itemIndex === index ? { ...slot, ...patch } : slot,
      ),
    );
  }

  async function onConfirm(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const parsed = parseAssistenteFormInput(formValue);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }

    setPending(true);
    try {
      const result = await previewAssistenteContext(parsed.value);
      if ("error" in result) {
        setError(result.error);
        return;
      }

      setFormSnapshot(parsed.value);
      setPreview(result.data);
      setMessages([]);
      setStep("chat");

      const history: ChatMessage[] = [
        { role: "user", content: FIRST_USER_MESSAGE },
      ];
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
    if (!formSnapshot || streaming || pending) return;
    const content = draft.trim();
    if (!content) return;

    const history: ChatMessage[] = [...messages, { role: "user", content }];
    setDraft("");
    setMessages(history);
    setPending(true);
    try {
      await streamReply(formSnapshot, history);
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
    setPreview(null);
    setFormSnapshot(null);
    setError(null);
    setStreaming(false);
    setPending(false);
  }

  if (step === "chat" && preview && formSnapshot) {
    return (
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-[var(--ink)]">
              {formSnapshot.studentName} ·{" "}
              {LOCATION_LABELS[formSnapshot.location]}
            </p>
            <p className="text-sm text-[var(--ink-muted)]">
              Recorte da agenda: {preview.weekLabel}
            </p>
          </div>
          <button type="button" className="btn-secondary px-3 py-2 text-sm" onClick={backToForm}>
            Voltar
          </button>
        </div>

        <div className="rounded-xl border border-[var(--accent)]/30 bg-[var(--accent-soft)] px-3 py-3 text-sm text-[var(--accent)]">
          Isto é uma sugestão — nada foi alterado na agenda.
        </div>

        <div className="panel space-y-2 p-4 text-sm">
          <p className="font-semibold">Grade ocupada nesta semana</p>
          {preview.occupied.length === 0 ? (
            <p className="text-[var(--ink-muted)]">
              Nenhuma aula agendada neste recorte. Remarcações pontuais de
              outras semanas não entram aqui.
            </p>
          ) : (
            <ul className="space-y-1 text-[var(--ink-muted)]">
              {preview.occupied.map((block) => (
                <li key={block.lessonId}>{formatOccupiedLabel(block)}</li>
              ))}
            </ul>
          )}
          {preview.candidates.length > 0 ? (
            <p className="pt-1 text-[var(--ink-muted)]">
              {preview.candidates.length} encaixe
              {preview.candidates.length === 1 ? "" : "s"} direto
              {preview.candidates.length === 1 ? "" : "s"} calculado
              {preview.candidates.length === 1 ? "" : "s"} pelo sistema.
            </p>
          ) : (
            <p className="pt-1 text-[var(--ink-muted)]">
              Sem encaixe direto: o assistente pode propor remarcações.
            </p>
          )}
        </div>

        <div className="space-y-3">
          {messages.map((message, index) => {
            if (
              index === 0 &&
              message.role === "user" &&
              message.content === FIRST_USER_MESSAGE
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

        {error && <p className="form-error">{error}</p>}

        <form onSubmit={onSend} className="flex flex-col gap-2 sm:flex-row">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Ajuste a sugestão: outro dia, outro aluno..."
            className="input"
            disabled={streaming || pending}
          />
          <button
            type="submit"
            disabled={streaming || pending || !draft.trim()}
            className="btn-primary shrink-0"
          >
            {streaming ? "Enviando..." : "Enviar"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <form onSubmit={onConfirm} className="panel space-y-4 p-5">
      <label className="block text-sm font-medium text-[var(--ink-muted)]">
        Nome do aluno
        <input
          list="assistente-alunos"
          value={studentName}
          onChange={(event) => {
            const name = event.target.value;
            setStudentName(name);
            const match = students.find((student) => student.name === name);
            if (match?.defaultLocation) setLocation(match.defaultLocation);
          }}
          placeholder="Ex.: Carla"
          className="input mt-1"
          required
        />
        <datalist id="assistente-alunos">
          {students.map((student) => (
            <option key={student.id} value={student.name} />
          ))}
        </datalist>
      </label>

      <label className="block text-sm font-medium text-[var(--ink-muted)]">
        Aulas por semana
        <input
          type="number"
          min={1}
          max={14}
          value={lessonsPerWeek}
          onChange={(event) => setLessonsPerWeek(Number(event.target.value))}
          className="input mt-1"
          required
        />
      </label>

      <LocationRadios value={location} onChange={setLocation} />

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-[var(--ink-muted)]">
          Horários disponíveis do aluno
        </legend>
        <p className="text-sm text-[var(--ink-muted)]">
          Hora = início da aula de 1 hora. Você pode adicionar vários.
        </p>
        {studentSlots.map((slot, index) => (
          <div key={index} className="flex flex-col gap-2 sm:flex-row">
            <select
              value={slot.weekday}
              onChange={(event) =>
                updateStudentSlot(index, {
                  weekday: Number(event.target.value) as Weekday,
                })
              }
              className="input"
            >
              {WEEKDAYS.map((day) => (
                <option key={day} value={day}>
                  {WEEKDAY_LABELS[day]}
                </option>
              ))}
            </select>
            <input
              type="time"
              value={slot.time}
              onChange={(event) =>
                updateStudentSlot(index, { time: event.target.value })
              }
              className="input"
              required
            />
            {studentSlots.length > 1 ? (
              <button
                type="button"
                className="btn-secondary shrink-0 px-3"
                onClick={() =>
                  setStudentSlots((current) =>
                    current.filter((_, itemIndex) => itemIndex !== index),
                  )
                }
              >
                Remover
              </button>
            ) : null}
          </div>
        ))}
        <button
          type="button"
          className="btn-secondary"
          onClick={() =>
            setStudentSlots((current) => [...current, emptyStudentSlot()])
          }
        >
          Adicionar horário
        </button>
      </fieldset>

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

      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "Lendo a agenda..." : "Confirmar e consultar"}
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
                {renderInline(line)}
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
