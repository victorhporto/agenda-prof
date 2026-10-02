import type { Coordinates } from "@/lib/geo/geocode";

/** Sem coordenadas dos dois lados, vale a regra antiga de 1h de deslocamento. */
export const FALLBACK_TRAVEL_MINUTES = 60;
/** Ruas não são linha reta: a distância em linha reta é multiplicada por isto. */
const ROAD_FACTOR = 1.4;
/** Velocidade média urbana considerando trânsito. */
const AVERAGE_SPEED_KMH = 20;
const TRAVEL_STEP_MINUTES = 15;
/** Abaixo disso o lugar é considerado o mesmo (sem deslocamento). */
const SAME_PLACE_KM = 0.2;

/**
 * Onde a aula acontece. Aulas online e na casa do professor ficam na base do
 * professor; aulas na casa do aluno ficam no endereço do aluno.
 */
export type Place = {
  key: string;
  coords: Coordinates | null;
};

export type TravelEstimate = {
  minutes: number;
  /** Distância estimada por ruas; null quando faltam coordenadas. */
  km: number | null;
};

export const NO_TRAVEL: TravelEstimate = { minutes: 0, km: 0 };

export function basePlace(coords: Coordinates | null = null): Place {
  return { key: "base", coords };
}

export function studentPlace(
  studentKey: string,
  coords: Coordinates | null = null,
): Place {
  return { key: `aluno:${studentKey}`, coords };
}

export function isBase(place: Place) {
  return place.key === "base";
}

export function haversineKm(a: Coordinates, b: Coordinates): number {
  const earthRadiusKm = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadiusKm * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function roadDistanceKm(a: Coordinates, b: Coordinates): number {
  return haversineKm(a, b) * ROAD_FACTOR;
}

export function travelMinutesForKm(roadKm: number): number {
  if (roadKm < SAME_PLACE_KM) return 0;
  const raw = (roadKm / AVERAGE_SPEED_KMH) * 60;
  return Math.max(
    TRAVEL_STEP_MINUTES,
    Math.ceil(raw / TRAVEL_STEP_MINUTES) * TRAVEL_STEP_MINUTES,
  );
}

export function estimateTravel(from: Place, to: Place): TravelEstimate {
  if (from.key === to.key) return NO_TRAVEL;
  if (!from.coords || !to.coords) {
    return { minutes: FALLBACK_TRAVEL_MINUTES, km: null };
  }
  const km = roadDistanceKm(from.coords, to.coords);
  return { minutes: travelMinutesForKm(km), km };
}

export function formatKm(km: number): string {
  return `${km.toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} km`;
}

export function formatTravel(travel: TravelEstimate): string {
  const minutes = `~${travel.minutes} min`;
  return travel.km == null ? `${minutes} (sem endereço)` : `${minutes} (${formatKm(travel.km)})`;
}

export type RouteStop = {
  /** Minutos desde 00:00. */
  start: number;
  end: number;
  place: Place;
};

export type InsertionResult = {
  ok: boolean;
  before: TravelEstimate;
  after: TravelEstimate;
  /** Deslocamento que a aula acrescenta ao dia (minutos estimados). */
  extraMinutes: number;
  extraKm: number;
};

function kmOrZero(travel: TravelEstimate) {
  return travel.km ?? 0;
}

/**
 * Encaixa uma aula na sequência do dia: precisa caber o deslocamento desde a
 * aula anterior (ou desde a base) e até a próxima. O deslocamento antes da
 * primeira aula e depois da última pode sair da janela do professor.
 */
export function checkInsertion(
  stops: RouteStop[],
  candidate: RouteStop,
  base: Place,
): InsertionResult {
  let prev: RouteStop | null = null;
  let next: RouteStop | null = null;
  let overlaps = false;
  for (const stop of stops) {
    if (candidate.start < stop.end && stop.start < candidate.end) {
      overlaps = true;
      break;
    }
    if (stop.end <= candidate.start) {
      if (!prev || stop.end > prev.end) prev = stop;
    } else if (!next || stop.start < next.start) {
      next = stop;
    }
  }

  const prevPlace = prev?.place ?? base;
  const nextPlace = next?.place ?? base;
  const before = estimateTravel(prevPlace, candidate.place);
  const after = estimateTravel(candidate.place, nextPlace);
  const direct = estimateTravel(prevPlace, nextPlace);

  const fitsBefore = !prev || candidate.start - prev.end >= before.minutes;
  const fitsAfter = !next || next.start - candidate.end >= after.minutes;

  return {
    ok: !overlaps && fitsBefore && fitsAfter,
    before,
    after,
    extraMinutes: before.minutes + after.minutes - direct.minutes,
    extraKm: kmOrZero(before) + kmOrZero(after) - kmOrZero(direct),
  };
}

/** Deslocamento total do dia: base → aulas em ordem → base. */
export function dayRouteCost(
  stops: RouteStop[],
  base: Place,
): { minutes: number; km: number } {
  const sorted = [...stops].sort((a, b) => a.start - b.start);
  let minutes = 0;
  let km = 0;
  let current = base;
  for (const stop of [...sorted.map((item) => item.place), base]) {
    const travel = estimateTravel(current, stop);
    minutes += travel.minutes;
    km += kmOrZero(travel);
    current = stop;
  }
  return { minutes, km };
}
