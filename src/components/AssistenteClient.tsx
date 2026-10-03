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
import {
  ChatComposer,
  ChatThread,
  streamAssistantChat,
  type ChatMessage,
} from "@/components/AssistenteChat";
import type { LessonLocation } from "@/lib/lessons/location";

type StudentOption = {
  id: string;
  name: string;
  defaultLocation: LessonLocation | null;
};

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
    await streamAssistantChat({
      endpoint: "/api/assistente/chat",
      context,
      history,
      onText: setMessages,
    });
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
          <p className="font-semibold">Grade ocupada (próximos 7 dias + quem ainda não renovou)</p>
          {preview.occupied.length === 0 ? (
            <p className="text-[var(--ink-muted)]">
              Nenhuma aula neste recorte. Só entram as aulas dos próximos 7
              dias e, para quem ainda não renovou, as da semana anterior.
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
          placeholder="Ajuste a sugestão: outro dia, outro aluno..."
        />
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
