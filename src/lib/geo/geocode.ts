const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const VIACEP_URL = "https://viacep.com.br/ws";
const MIN_INTERVAL_MS = process.env.VITEST ? 0 : 1100;
export const MAX_ADDRESS_LENGTH = 300;

export type Coordinates = { lat: number; lng: number };

export type ResolvedAddress = {
  address: string | null;
  lat: number | null;
  lng: number | null;
};

let queue: Promise<unknown> = Promise.resolve();
let lastRequestAt = 0;

/** A política do Nominatim permite no máximo 1 requisição por segundo. */
function throttled<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastRequestAt = Date.now();
    return task();
  });
  queue = run.catch(() => undefined);
  return run;
}

function userAgent() {
  const contact = process.env.NOMINATIM_CONTACT_EMAIL;
  return contact ? `AgendaProf/1.0 (${contact})` : "AgendaProf/1.0";
}

function comparable(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

type NominatimResult = {
  lat?: string;
  lon?: string;
  address?: Record<string, string | undefined>;
};

/**
 * Ruas homônimas são comuns (ex.: "Rua Caranguejo" em Guarulhos e em São
 * Paulo), então quando a cidade é conhecida o resultado precisa bater com ela.
 */
async function search(
  query: Record<string, string>,
  expectedCity?: string,
): Promise<Coordinates | null> {
  const params = new URLSearchParams({
    ...query,
    format: "jsonv2",
    limit: "3",
    addressdetails: "1",
    countrycodes: "br",
    "accept-language": "pt-BR",
  });
  const response = await throttled(() =>
    fetch(`${NOMINATIM_URL}?${params.toString()}`, {
      headers: { "User-Agent": userAgent() },
      signal: AbortSignal.timeout(6000),
      cache: "no-store",
    }),
  );
  if (!response.ok) return null;
  const results = (await response.json()) as NominatimResult[];
  const city = expectedCity ? comparable(expectedCity) : null;
  const match = results.find((result) => {
    if (!city) return true;
    const place = result.address;
    return [place?.city, place?.town, place?.village, place?.municipality]
      .filter((name): name is string => Boolean(name))
      .some((name) => comparable(name) === city);
  });
  const lat = Number(match?.lat);
  const lng = Number(match?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

type CepInfo = {
  street: string;
  neighborhood: string;
  city: string;
  state: string;
};

async function lookupCep(cep: string): Promise<CepInfo | null> {
  const response = await fetch(`${VIACEP_URL}/${cep}/json/`, {
    signal: AbortSignal.timeout(5000),
    cache: "no-store",
  });
  if (!response.ok) return null;
  const data = (await response.json()) as {
    erro?: unknown;
    logradouro?: string;
    bairro?: string;
    localidade?: string;
    uf?: string;
  };
  if (data.erro || !data.localidade) return null;
  return {
    street: data.logradouro ?? "",
    neighborhood: data.bairro ?? "",
    city: data.localidade,
    state: data.uf ?? "",
  };
}

const STREET_ABBREVIATIONS: [RegExp, string][] = [
  [/\bR\.\s*/gi, "Rua "],
  [/\bAv\.\s*/gi, "Avenida "],
  [/\bAl\.\s*/gi, "Alameda "],
  [/\bTrav\.\s*/gi, "Travessa "],
  [/\bTv\.\s*/gi, "Travessa "],
  [/\bEstr\.\s*/gi, "Estrada "],
  [/\bRod\.\s*/gi, "Rodovia "],
  [/\bPç\.\s*/gi, "Praça "],
  [/\bPça\.\s*/gi, "Praça "],
];

export type ParsedAddress = {
  /** Endereço com abreviações expandidas, sem faixas de número nem "- UF". */
  text: string;
  street: string;
  number: string | null;
  cep: string | null;
};

/**
 * Entende o formato copiado do Google Maps, ex.:
 * "R. do Tramway, 400-454 - Tucuruvi São Paulo - SP, 02303-080".
 */
export function parseAddress(address: string): ParsedAddress {
  const cepMatch = address.match(/\b(\d{5})-?(\d{3})\b/);
  const cep = cepMatch ? `${cepMatch[1]}${cepMatch[2]}` : null;

  let text = address;
  for (const [pattern, replacement] of STREET_ABBREVIATIONS) {
    text = text.replace(pattern, replacement);
  }
  text = text
    .replace(/\b(\d{1,5})\s*-\s*\d{1,5}\b(?!\d)/g, (range, first: string) =>
      cepMatch && range.includes(cepMatch[1]!) ? range : first,
    )
    .replace(/\s+-\s+[A-Z]{2}\b/g, "")
    .replace(/\s+-\s+/g, ", ")
    .replace(/\s{2,}/g, " ")
    .trim();

  const [street = "", second = ""] = text.split(",").map((part) => part.trim());
  const number = second.match(/^(\d{1,5})[A-Za-z]?\b/)?.[1] ?? null;
  return { text, street, number, cep };
}

/** Sem o número da casa, preservando o CEP (ex.: 01310-100 ou 01310100). */
export function withoutHouseNumber(address: string): string {
  const ceps: string[] = [];
  const masked = address.replace(/\b\d{5}-?\d{3}\b/g, (cep) => {
    ceps.push(cep);
    return `__CEP${ceps.length - 1}__`;
  });
  return masked
    .replace(/\b\d{1,5}[A-Za-z]?\b/g, "")
    .replace(/__CEP(\d+)__/g, (_, index: string) => ceps[Number(index)]!)
    .replace(/\s*,(\s*,)+/g, ",")
    .replace(/\s+,/g, ",")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s,-]+|[\s,-]+$/g, "");
}

async function geocodeWithCep(
  parsed: ParsedAddress,
  cep: string,
): Promise<Coordinates | null> {
  const info = await lookupCep(cep).catch(() => null);
  const postalcode = `${cep.slice(0, 5)}-${cep.slice(5)}`;
  const street = info?.street || parsed.street;
  const city = info?.city;
  const state = info?.state;
  const place = { ...(city ? { city } : {}), ...(state ? { state } : {}) };

  const attempts: Record<string, string>[] = [];
  if (street) {
    const numbered = parsed.number ? `${parsed.number} ${street}` : street;
    attempts.push({ street: numbered, ...place, postalcode });
    if (city) attempts.push({ street, ...place });
  }
  if (info?.neighborhood && city) {
    attempts.push({ q: `${info.neighborhood}, ${city}, ${state ?? ""}` });
  }
  attempts.push({ postalcode, country: "Brasil" });

  for (const attempt of attempts) {
    const found = await search(attempt, city);
    if (found) return found;
  }
  return null;
}

/**
 * Com CEP, usa o ViaCEP para descobrir rua/cidade e faz buscas estruturadas
 * (do mais preciso ao bairro); sem CEP, busca o texto livre.
 */
export async function geocodeAddress(
  address: string,
): Promise<Coordinates | null> {
  try {
    const parsed = parseAddress(address);
    if (parsed.cep) return await geocodeWithCep(parsed, parsed.cep);
    const exact = await search({ q: parsed.text });
    if (exact) return exact;
    const broader = withoutHouseNumber(parsed.text);
    if (broader && broader !== parsed.text) return await search({ q: broader });
    return null;
  } catch {
    return null;
  }
}

export function normalizeAddress(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const address = raw.replace(/\s+/g, " ").trim().slice(0, MAX_ADDRESS_LENGTH);
  return address || null;
}

/**
 * Só consulta o Nominatim quando o endereço mudou ou ainda não foi
 * localizado; caso contrário reaproveita as coordenadas já salvas.
 */
export async function resolveAddress(
  raw: unknown,
  previous?: ResolvedAddress | null,
): Promise<ResolvedAddress> {
  const address = normalizeAddress(raw);
  if (!address) return { address: null, lat: null, lng: null };
  if (
    previous?.address === address &&
    previous.lat != null &&
    previous.lng != null
  ) {
    return previous;
  }
  const coords = await geocodeAddress(address);
  return { address, lat: coords?.lat ?? null, lng: coords?.lng ?? null };
}
