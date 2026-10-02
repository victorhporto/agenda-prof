export type AddressParts = {
  cep: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
};

export const ADDRESS_FIELDS = [
  "cep",
  "street",
  "number",
  "complement",
  "neighborhood",
  "city",
  "state",
] as const satisfies readonly (keyof AddressParts)[];

export const EMPTY_ADDRESS: AddressParts = {
  cep: "",
  street: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
};

const MAX_LENGTH: Record<keyof AddressParts, number> = {
  cep: 9,
  street: 150,
  number: 20,
  complement: 80,
  neighborhood: 100,
  city: 100,
  state: 2,
};

export const BRAZIL_STATES = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE",
  "TO",
] as const;

export function cepDigits(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 8);
}

export function formatCep(raw: string): string {
  const digits = cepDigits(raw);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

function clean(value: unknown, field: keyof AddressParts): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, MAX_LENGTH[field]);
}

/** Leitura tolerante de qualquer objeto (formulário ou banco). */
export function toAddressParts(raw: unknown): AddressParts {
  const source =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const parts = { ...EMPTY_ADDRESS };
  for (const field of ADDRESS_FIELDS) parts[field] = clean(source[field], field);
  parts.cep = formatCep(parts.cep);
  parts.state = parts.state.toUpperCase();
  return parts;
}

export function isEmptyAddress(parts: AddressParts): boolean {
  return ADDRESS_FIELDS.every((field) => !parts[field]);
}

export function addressPartsFromFormData(
  formData: FormData,
  prefix = "address_",
): AddressParts {
  const raw: Record<string, unknown> = {};
  for (const field of ADDRESS_FIELDS) raw[field] = formData.get(`${prefix}${field}`);
  return toAddressParts(raw);
}

/** Vazio vira null (sem endereço); preenchido precisa de rua, cidade e UF. */
export function parseAddressParts(
  raw: unknown,
): { ok: true; value: AddressParts | null } | { ok: false; error: string } {
  const parts = toAddressParts(raw);
  if (isEmptyAddress(parts)) return { ok: true, value: null };
  if (parts.cep && cepDigits(parts.cep).length !== 8) {
    return { ok: false, error: "CEP deve ter 8 dígitos" };
  }
  if (!parts.street) return { ok: false, error: "Informe a rua do endereço" };
  if (!parts.city) return { ok: false, error: "Informe a cidade do endereço" };
  if (!(BRAZIL_STATES as readonly string[]).includes(parts.state)) {
    return { ok: false, error: "Selecione a UF do endereço" };
  }
  return { ok: true, value: parts };
}

/** "Rua X, 123 - Apto 4 - Bairro, Cidade - UF, 00000-000" */
export function composeAddress(parts: AddressParts): string {
  const streetLine = [
    parts.number ? `${parts.street}, ${parts.number}` : parts.street,
    parts.complement,
    parts.neighborhood,
  ]
    .filter(Boolean)
    .join(" - ");
  const cityLine = [parts.city, parts.state].filter(Boolean).join(" - ");
  return [streetLine, cityLine, parts.cep].filter(Boolean).join(", ");
}

/**
 * Endereços antigos eram um texto livre; aproveita CEP, rua e número para
 * pré-preencher os campos (o CEP completa o resto no formulário).
 */
export function partsFromLegacyText(address: string | null): AddressParts {
  if (!address) return { ...EMPTY_ADDRESS };
  const cep = address.match(/\b(\d{5})-?(\d{3})\b/);
  const [street = "", second = ""] = address
    .replace(/\s+-\s+/g, ", ")
    .split(",")
    .map((part) => part.trim());
  const number = second.match(/^\d{1,5}[A-Za-z]?/)?.[0] ?? "";
  return toAddressParts({
    cep: cep ? `${cep[1]}${cep[2]}` : "",
    street: /^\d/.test(street) ? "" : street,
    number,
  });
}

export function storedAddressParts(
  parts: unknown,
  legacyText: string | null,
): AddressParts {
  const stored = toAddressParts(parts);
  return isEmptyAddress(stored) ? partsFromLegacyText(legacyText) : stored;
}
