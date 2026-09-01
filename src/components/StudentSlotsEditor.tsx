"use client";

import {
  WEEKDAY_LABELS,
  WEEKDAYS,
  type StudentSlot,
  type Weekday,
} from "@/lib/assistente/occupancy";

function emptySlot(): StudentSlot {
  return { weekday: 1, time: "" };
}

export function StudentSlotsEditor({
  value,
  onChange,
}: {
  value: StudentSlot[];
  onChange: (next: StudentSlot[]) => void;
}) {
  const slots = value.length > 0 ? value : [emptySlot()];

  function update(index: number, patch: Partial<StudentSlot>) {
    onChange(
      slots.map((slot, itemIndex) =>
        itemIndex === index ? { ...slot, ...patch } : slot,
      ),
    );
  }

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium text-[var(--ink-muted)]">
        Horários disponíveis
      </legend>
      <p className="text-sm text-[var(--ink-muted)]">
        Hora = início da aula de 1 hora. Você pode adicionar vários.
      </p>
      {slots.map((slot, index) => (
        <div key={index} className="flex flex-col gap-2 sm:flex-row">
          <select
            value={slot.weekday}
            onChange={(event) =>
              update(index, {
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
            onChange={(event) => update(index, { time: event.target.value })}
            className="input"
            required
          />
          {slots.length > 1 ? (
            <button
              type="button"
              className="btn-secondary shrink-0 px-3"
              onClick={() =>
                onChange(slots.filter((_, itemIndex) => itemIndex !== index))
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
        onClick={() => onChange([...slots, emptySlot()])}
      >
        Adicionar horário
      </button>
    </fieldset>
  );
}
