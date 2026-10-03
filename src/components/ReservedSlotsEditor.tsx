"use client";

import { useState, useTransition } from "react";
import {
  WEEKDAY_LABELS,
  WEEKDAY_SHORT,
  WEEKDAYS,
  type StudentSlot,
  type Weekday,
} from "@/lib/assistente/occupancy";
import {
  findReservationConflicts,
  type ReservationOwner,
} from "@/lib/students/reserved";
import { suggestReservedSlotsForStudent } from "@/lib/students/actions";

export function ReservedSlotsEditor({
  name = "reserved_slots",
  defaultValue = [],
  others = [],
  studentId,
}: {
  name?: string;
  defaultValue?: StudentSlot[];
  others?: ReservationOwner[];
  studentId?: string;
}) {
  const [slots, setSlots] = useState<StudentSlot[]>(defaultValue);
  const [note, setNote] = useState<string | null>(null);
  const [suggesting, startSuggest] = useTransition();

  const filled = slots.filter((slot) => slot.time);
  const conflicts = findReservationConflicts(filled, others, studentId);

  function update(index: number, patch: Partial<StudentSlot>) {
    setSlots((current) =>
      current.map((slot, itemIndex) =>
        itemIndex === index ? { ...slot, ...patch } : slot,
      ),
    );
  }

  function suggest() {
    if (!studentId) return;
    setNote(null);
    startSuggest(async () => {
      const result = await suggestReservedSlotsForStudent(studentId);
      if ("error" in result) {
        setNote(result.error);
        return;
      }
      if (result.slots.length === 0) {
        setNote("Nenhuma aula recente para usar como base.");
        return;
      }
      setSlots(result.slots);
      setNote("Preenchido pelas últimas aulas — confira e salve.");
    });
  }

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-[var(--ink-muted)]">
        Horário reservado (semanal)
      </legend>
      <p className="text-sm text-[var(--ink-muted)]">
        A agenda ideal do aluno, sem remarcações ou reposições. Usado na grade
        ideal, no assistente e ao repetir pacote.
      </p>
      <input type="hidden" name={name} value={JSON.stringify(filled)} />
      {slots.length === 0 ? (
        <p className="text-sm text-[var(--ink-muted)]">Nenhum horário reservado.</p>
      ) : (
        slots.map((slot, index) => (
          <div key={index} className="flex gap-2">
            <select
              value={slot.weekday}
              onChange={(event) =>
                update(index, { weekday: Number(event.target.value) as Weekday })
              }
              className="input"
              aria-label="Dia reservado"
            >
              {WEEKDAYS.map((day) => (
                <option key={day} value={day}>
                  {WEEKDAY_LABELS[day]}
                </option>
              ))}
            </select>
            <input
              type="time"
              step={900}
              value={slot.time}
              onChange={(event) => update(index, { time: event.target.value })}
              className="input"
              aria-label="Hora reservada"
              required
            />
            <button
              type="button"
              className="btn-secondary shrink-0 px-3"
              onClick={() =>
                setSlots((current) => current.filter((_, itemIndex) => itemIndex !== index))
              }
            >
              Remover
            </button>
          </div>
        ))
      )}
      {conflicts.length > 0 ? (
        <ul className="space-y-1 text-sm text-[var(--warning)]">
          {conflicts.map((conflict) => (
            <li key={`${conflict.slot.weekday}-${conflict.slot.time}`}>
              {WEEKDAY_SHORT[conflict.slot.weekday]} {conflict.slot.time} bate com a
              reserva de {conflict.names.join(", ")}.
            </li>
          ))}
        </ul>
      ) : null}
      {note ? <p className="text-sm text-[var(--ink-muted)]">{note}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-secondary"
          onClick={() =>
            setSlots((current) => [
              ...current,
              { weekday: (current[current.length - 1]?.weekday ?? 1) as Weekday, time: "" },
            ])
          }
        >
          Adicionar horário
        </button>
        {studentId ? (
          <button
            type="button"
            className="btn-secondary"
            onClick={suggest}
            disabled={suggesting}
          >
            {suggesting ? "Buscando..." : "Preencher pelas últimas aulas"}
          </button>
        ) : null}
      </div>
    </fieldset>
  );
}
