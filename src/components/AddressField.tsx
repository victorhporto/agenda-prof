const MAX_ADDRESS_LENGTH = 300;

export function AddressField({
  name,
  label = "Endereço",
  defaultValue,
  value,
  onChange,
  hint = "Usado para estimar o deslocamento em aulas na casa do aluno.",
}: {
  name?: string;
  label?: string;
  defaultValue?: string | null;
  value?: string;
  onChange?: (value: string) => void;
  hint?: string;
}) {
  const controlled = value !== undefined;
  return (
    <label className="block text-sm font-medium text-[var(--ink-muted)]">
      {label}
      <input
        name={name}
        {...(controlled
          ? { value, onChange: (event) => onChange?.(event.target.value) }
          : { defaultValue: defaultValue ?? "" })}
        maxLength={MAX_ADDRESS_LENGTH}
        autoComplete="street-address"
        className="input mt-1"
        placeholder="Rua, número, bairro, cidade"
      />
      <span className="mt-1 block text-xs font-normal">
        {hint} Localização por{" "}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          © OpenStreetMap
        </a>
        .
      </span>
    </label>
  );
}

export function AddressLine({
  address,
  lat,
}: {
  address: string | null;
  lat: number | null;
}) {
  if (!address) return null;
  return (
    <p className="text-sm text-[var(--ink-muted)]">
      {address}
      {lat == null ? (
        <span className="ml-1 text-[var(--warning)]">
          · não localizado no mapa
        </span>
      ) : null}
    </p>
  );
}
