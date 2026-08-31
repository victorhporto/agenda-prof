"use client";

import {
  WEEKDAY_LABELS,
  WEEKDAYS,
  type TeacherWindow,
  type Weekday,
} from "@/lib/assistente/occupancy";

export function TeacherWindowsEditor({
  value,
  onChange,
}: {
  value: TeacherWindow[];
  onChange: (next: TeacherWindow[]) => void;
}) {
  function update(index: number, patch: Partial<TeacherWindow>) {
    onChange(
      value.map((window, itemIndex) =>
        itemIndex === index ? { ...window, ...patch } : window,
      ),
    );
  }

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium text-[var(--ink-muted)]">
        Horário disponível
      </legend>
      {value.map((window, index) => (
        <div key={index} className="flex flex-col gap-2 sm:flex-row">
          <select
            value={window.weekday}
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
            value={window.start}
            onChange={(event) => update(index, { start: event.target.value })}
            className="input"
            required
          />
          <input
            type="time"
            value={window.end}
            onChange={(event) => update(index, { end: event.target.value })}
            className="input"
            required
          />
          {value.length > 1 ? (
            <button
              type="button"
              className="btn-secondary shrink-0 px-3"
              onClick={() =>
                onChange(value.filter((_, itemIndex) => itemIndex !== index))
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
          onChange([...value, { weekday: 6, start: "10:00", end: "20:00" }])
        }
      >
        Adicionar intervalo
      </button>
    </fieldset>
  );
}
