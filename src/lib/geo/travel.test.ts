import { describe, expect, it } from "vitest";
import {
  FALLBACK_TRAVEL_MINUTES,
  basePlace,
  checkInsertion,
  dayRouteCost,
  estimateTravel,
  formatTravel,
  haversineKm,
  studentPlace,
  travelMinutesForKm,
} from "@/lib/geo/travel";

const VILA_MAZZEI = { lat: -23.4796813, lng: -46.6029076 };
const TRAMWAY = { lat: -23.4834798, lng: -46.6099892 };
const CONCEICAO = { lat: -23.5001193, lng: -46.6107279 };
const MASP = { lat: -23.5614961, lng: -46.6559677 };

describe("haversineKm", () => {
  it("mede a distância em linha reta", () => {
    expect(haversineKm(TRAMWAY, CONCEICAO)).toBeCloseTo(1.85, 1);
    expect(haversineKm(VILA_MAZZEI, MASP)).toBeCloseTo(10.6, 0);
  });
});

describe("travelMinutesForKm", () => {
  it("arredonda para blocos de 15 min com mínimo de 15", () => {
    expect(travelMinutesForKm(0.1)).toBe(0);
    expect(travelMinutesForKm(1)).toBe(15);
    expect(travelMinutesForKm(5)).toBe(15);
    expect(travelMinutesForKm(5.1)).toBe(30);
    expect(travelMinutesForKm(14.8)).toBe(45);
  });
});

describe("estimateTravel", () => {
  it("usa a distância por ruas quando os dois lados têm coordenadas", () => {
    const travel = estimateTravel(
      basePlace(VILA_MAZZEI),
      studentPlace("masp", MASP),
    );
    expect(travel.minutes).toBe(45);
    expect(travel.km).toBeCloseTo(14.8, 0);
    expect(formatTravel(travel)).toMatch(/^~45 min \(14,\d km\)$/);
  });

  it("mesmo lugar não tem deslocamento", () => {
    expect(estimateTravel(basePlace(), basePlace()).minutes).toBe(0);
    expect(
      estimateTravel(studentPlace("a"), studentPlace("a")).minutes,
    ).toBe(0);
  });

  it("sem coordenadas usa a estimativa padrão de 1h", () => {
    expect(estimateTravel(basePlace(VILA_MAZZEI), studentPlace("x"))).toEqual({
      minutes: FALLBACK_TRAVEL_MINUTES,
      km: null,
    });
  });
});

describe("checkInsertion", () => {
  const base = basePlace(VILA_MAZZEI);
  const tramway = studentPlace("tramway", TRAMWAY);
  const conceicao = studentPlace("conceicao", CONCEICAO);
  const masp = studentPlace("masp", MASP);
  const day = [{ start: 14 * 60, end: 15 * 60, place: tramway }];

  it("aluno perto cabe logo depois; longe precisa de mais intervalo", () => {
    const near = checkInsertion(
      day,
      { start: 15 * 60 + 15, end: 16 * 60 + 15, place: conceicao },
      base,
    );
    expect(near.ok).toBe(true);

    const far = checkInsertion(
      day,
      { start: 15 * 60 + 15, end: 16 * 60 + 15, place: masp },
      base,
    );
    expect(far.ok).toBe(false);
    expect(far.before.minutes).toBe(45);
  });

  it("rejeita sobreposição com outra aula", () => {
    expect(
      checkInsertion(
        day,
        { start: 14 * 60 + 30, end: 15 * 60 + 30, place: base },
        base,
      ).ok,
    ).toBe(false);
  });

  it("calcula o deslocamento extra que o horário acrescenta ao dia", () => {
    const near = checkInsertion(
      day,
      { start: 16 * 60, end: 17 * 60, place: conceicao },
      base,
    );
    const far = checkInsertion(
      day,
      { start: 16 * 60, end: 17 * 60, place: masp },
      base,
    );
    expect(near.extraKm).toBeLessThan(far.extraKm);
    expect(near.extraMinutes).toBeLessThan(far.extraMinutes);
  });

  it("deslocamento antes da primeira aula pode sair da janela", () => {
    expect(
      checkInsertion(
        [],
        { start: 0, end: 60, place: studentPlace("x") },
        base,
      ).ok,
    ).toBe(true);
  });
});

describe("dayRouteCost", () => {
  it("soma base → aulas → base", () => {
    const base = basePlace(VILA_MAZZEI);
    const cost = dayRouteCost(
      [
        { start: 16 * 60, end: 17 * 60, place: studentPlace("c", CONCEICAO) },
        { start: 14 * 60, end: 15 * 60, place: studentPlace("t", TRAMWAY) },
      ],
      base,
    );
    expect(cost.minutes).toBe(45);
    expect(cost.km).toBeGreaterThan(6);
  });
});
