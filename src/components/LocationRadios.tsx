"use client";

import {
  LOCATION_LABELS,
  LOCATIONS,
  type LessonLocation,
} from "@/lib/lessons/location";

export function LocationRadios({
  value,
  onChange,
  name = "location",
  legend = "Local da aula",
}: {
  value: LessonLocation;
  onChange?: (value: LessonLocation) => void;
  name?: string;
  legend?: string;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-[var(--ink-muted)]">
        {legend}
      </legend>
      {LOCATIONS.map((option) => (
        <label
          key={option}
          className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3"
        >
          <input
            type="radio"
            name={name}
            value={option}
            checked={value === option}
            onChange={() => onChange?.(option)}
            className="mt-1"
            required
          />
          <span className="font-medium text-[var(--ink)]">
            {LOCATION_LABELS[option]}
          </span>
        </label>
      ))}
    </fieldset>
  );
}
