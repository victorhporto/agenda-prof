import { describe, expect, it } from "vitest";
import { ninetyNineRideUrl, uberRideUrl } from "@/lib/geo/rides";

const destination = {
  lat: -23.4834798,
  lng: -46.6099892,
  title: "Teste 1",
  address: "Rua do Tramway, 400 - Tucuruvi, São Paulo - SP, 02303-080",
};

describe("uberRideUrl", () => {
  it("parte da localização atual e leva ao endereço do aluno", () => {
    const url = new URL(uberRideUrl(destination));
    expect(url.origin + url.pathname).toBe("https://m.uber.com/ul/");
    expect(url.searchParams.get("action")).toBe("setPickup");
    expect(url.searchParams.get("pickup")).toBe("my_location");
    expect(url.searchParams.get("dropoff[latitude]")).toBe("-23.4834798");
    expect(url.searchParams.get("dropoff[longitude]")).toBe("-46.6099892");
    expect(url.searchParams.get("dropoff[nickname]")).toBe("Teste 1");
    expect(url.searchParams.get("dropoff[formatted_address]")).toContain(
      "Rua do Tramway",
    );
  });
});

describe("ninetyNineRideUrl", () => {
  it("usa o esquema do app com partida, destino e categoria", () => {
    const url = ninetyNineRideUrl(
      { lat: -23.4729562, lng: -46.6008217, title: "Ponto de partida" },
      destination,
    );
    expect(url.startsWith("taxis99://call?")).toBe(true);
    const params = new URLSearchParams(url.split("?")[1]);
    expect(params.get("pickup_latitude")).toBe("-23.4729562");
    expect(params.get("pickup_title")).toBe("Ponto de partida");
    expect(params.get("dropoff_longitude")).toBe("-46.6099892");
    expect(params.get("dropoff_title")).toBe("Teste 1");
    expect(params.get("deep_link_product_id")).toBe("316");
    expect(params.get("client_id")).toMatch(/^MAP_/);
  });
});
