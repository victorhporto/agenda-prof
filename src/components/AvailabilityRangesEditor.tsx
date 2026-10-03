"use client";

import { WEEKDAY_LABELS, WEEKDAYS, type Weekday } from "@/lib/assistente/occupancy";
import type { AvailabilityRange } from "@/lib/assistente/rearrange";

function emptyRange(): AvailabilityRange {
  return { weekday: 1, start: "", end: "" };
}

export function AvailabilityRangesEditor({
  value,
  onChange,
}: {
  value: AvailabilityRange[];
  onChange: (next: AvailabilityRange[]) => void;
}) {
  const ranges = value.length > 0 ? value : [emptyRange()];

  function update(index: number, patch: Partial<AvailabilityRange>) {
    onChange(
      ranges.map((range, itemIndex) =>
        itemIndex === index ? { ...range, ...patch } : range,
      ),
    );
  }

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium text-[var(--ink-muted)]">
        Quando o aluno pode ter aula
      </legend>
      <p className="text-sm text-[var(--ink-muted)]">
        Informe faixas, como &quot;Sexta das 10h às 15h&quot;. A aula de 1 hora
        precisa caber inteira na faixa.
      </p>
      {ranges.map((range, index) => (
        <div key={index} className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <select
            value={range.weekday}
            onChange={(event) =>
              update(index, { weekday: Number(event.target.value) as Weekday })
            }
            className="input sm:w-36"
            aria-label="Dia da semana"
          >
            {WEEKDAYS.map((day) => (
              <option key={day} value={day}>
                {WEEKDAY_LABELS[day]}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <span className="text-sm text-[var(--ink-muted)]">das</span>
            <input
              type="time"
              step={900}
              value={range.start}
              onChange={(event) => update(index, { start: event.target.value })}
              className="input"
              aria-label="Início da faixa"
              required
            />
            <span className="text-sm text-[var(--ink-muted)]">às</span>
            <input
              type="time"
              step={900}
              value={range.end}
              onChange={(event) => update(index, { end: event.target.value })}
              className="input"
              aria-label="Fim da faixa"
              required
            />
          </div>
          {ranges.length > 1 ? (
            <button
              type="button"
              className="btn-secondary shrink-0 px-3"
              onClick={() =>
                onChange(ranges.filter((_, itemIndex) => itemIndex !== index))
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
        onClick={() => onChange([...ranges, emptyRange()])}
      >
        Adicionar faixa
      </button>
    </fieldset>
  );
}
