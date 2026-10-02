import {
  cepDigits,
  composeAddress,
  type AddressParts,
} from "@/lib/geo/address";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const VIACEP_URL = "https://viacep.com.br/ws";
const MIN_INTERVAL_MS = process.env.VITEST ? 0 : 1100;

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
 * Paulo), então o resultado precisa estar na cidade informada.
 */
async function search(
  query: Record<string, string>,
  expectedCity: string,
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
  const city = comparable(expectedCity);
  const match = results.find((result) => {
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

type CepInfo = { street: string; neighborhood: string; city: string; state: string };

export async function lookupCep(cep: string): Promise<CepInfo | null> {
  const digits = cepDigits(cep);
  if (digits.length !== 8) return null;
  const response = await fetch(`${VIACEP_URL}/${digits}/json/`, {
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
  [/^R\.?\s+/i, "Rua "],
  [/^Av\.?\s+/i, "Avenida "],
  [/^Al\.?\s+/i, "Alameda "],
  [/^(Trav|Tv)\.?\s+/i, "Travessa "],
  [/^Estr\.?\s+/i, "Estrada "],
  [/^Rod\.?\s+/i, "Rodovia "],
  [/^(Pç|Pça|Praça)\.?\s+/i, "Praça "],
];

export function expandStreet(street: string): string {
  for (const [pattern, replacement] of STREET_ABBREVIATIONS) {
    if (pattern.test(street)) return street.replace(pattern, replacement);
  }
  return street;
}

/** Primeiro número de uma faixa ("400-454" → "400"); "s/n" vira vazio. */
function houseNumber(number: string): string {
  return number.match(/\d{1,6}/)?.[0] ?? "";
}

/**
 * Do mais preciso ao aproximado: rua + número + CEP, rua na cidade, bairro na
 * cidade e, por fim, o centro do CEP.
 */
export async function geocodeParts(
  parts: AddressParts,
): Promise<Coordinates | null> {
  try {
    const cep = cepDigits(parts.cep);
    const postalcode = cep.length === 8 ? `${cep.slice(0, 5)}-${cep.slice(5)}` : "";
    const city = parts.city;
    const state = parts.state;
    const street = expandStreet(parts.street);
    const number = houseNumber(parts.number);

    const attempts: Record<string, string>[] = [
      {
        street: number ? `${number} ${street}` : street,
        city,
        state,
        ...(postalcode ? { postalcode } : {}),
      },
      { street, city, state },
    ];
    if (parts.neighborhood) {
      attempts.push({ q: `${parts.neighborhood}, ${city}, ${state}` });
    }
    if (postalcode) attempts.push({ postalcode, country: "Brasil" });

    for (const attempt of attempts) {
      const found = await search(attempt, city);
      if (found) return found;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Só consulta o Nominatim quando o endereço mudou ou ainda não foi
 * localizado; caso contrário reaproveita as coordenadas já salvas.
 */
export async function resolveAddressParts(
  parts: AddressParts | null,
  previous?: ResolvedAddress | null,
): Promise<ResolvedAddress> {
  if (!parts) return { address: null, lat: null, lng: null };
  const address = composeAddress(parts);
  if (
    previous?.address === address &&
    previous.lat != null &&
    previous.lng != null
  ) {
    return previous;
  }
  const coords = await geocodeParts(parts);
  return { address, lat: coords?.lat ?? null, lng: coords?.lng ?? null };
}
