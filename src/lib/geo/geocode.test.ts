import { afterEach, describe, expect, it, vi } from "vitest";
import {
  normalizeAddress,
  parseAddress,
  resolveAddress,
  withoutHouseNumber,
} from "@/lib/geo/geocode";

type FakeResult = { lat: string; lon: string; city?: string };

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function nominatimResponse(results: FakeResult[]) {
  return jsonResponse(
    results.map(({ city, ...rest }) => ({
      ...rest,
      address: city ? { city } : {},
    })),
  );
}

const viaCepCaranguejo = {
  cep: "02307-000",
  logradouro: "Rua Caranguejo",
  bairro: "Tucuruvi",
  localidade: "São Paulo",
  uf: "SP",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("normalizeAddress", () => {
  it("limpa espaços e trata vazio como sem endereço", () => {
    expect(normalizeAddress("  Rua A,   10  ")).toBe("Rua A, 10");
    expect(normalizeAddress("   ")).toBeNull();
    expect(normalizeAddress(null)).toBeNull();
  });
});

describe("parseAddress", () => {
  it("entende o formato copiado do Google Maps", () => {
    expect(
      parseAddress("R. do Tramway, 400-454 - Tucuruvi São Paulo - SP, 02303-080"),
    ).toEqual({
      text: "Rua do Tramway, 400, Tucuruvi São Paulo, 02303-080",
      street: "Rua do Tramway",
      number: "400",
      cep: "02303080",
    });
    expect(parseAddress("Av. Conceição, 254-326 - Carandiru").street).toBe(
      "Avenida Conceição",
    );
  });

  it("funciona sem CEP e sem número", () => {
    expect(parseAddress("Praça da Sé, São Paulo")).toMatchObject({
      street: "Praça da Sé",
      number: null,
      cep: null,
    });
  });
});

describe("withoutHouseNumber", () => {
  it("tira o número da casa e mantém o CEP", () => {
    expect(
      withoutHouseNumber("Rua Augusta, 1500, Consolação, São Paulo, 01310-100"),
    ).toBe("Rua Augusta, Consolação, São Paulo, 01310-100");
    expect(withoutHouseNumber("Av. Paulista 900A - São Paulo")).toBe(
      "Av. Paulista - São Paulo",
    );
  });
});

describe("resolveAddress", () => {
  it("reaproveita coordenadas quando o endereço não mudou", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const previous = { address: "Rua A, 10", lat: -23.5, lng: -46.6 };

    expect(await resolveAddress(" Rua A,  10 ", previous)).toEqual(previous);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("localiza endereço sem CEP e identifica o app na requisição", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(nominatimResponse([{ lat: "-23.55", lon: "-46.63" }]));
    vi.stubGlobal("fetch", fetchMock);

    expect(await resolveAddress("Rua Augusta, 1500, São Paulo")).toEqual({
      address: "Rua Augusta, 1500, São Paulo",
      lat: -23.55,
      lng: -46.63,
    });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain("countrycodes=br");
    expect(init.headers["User-Agent"]).toMatch(/^AgendaProf/);
  });

  it("com CEP faz busca estruturada com rua, número e cidade do ViaCEP", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(viaCepCaranguejo))
      .mockResolvedValueOnce(
        nominatimResponse([{ lat: "-23.47", lon: "-46.60", city: "São Paulo" }]),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await resolveAddress(
      "R. Caranguejo, 246 - Vila Mazzei São Paulo - SP, 02307-000",
    );
    expect(result).toMatchObject({ lat: -23.47, lng: -46.6 });
    expect(String(fetchMock.mock.calls[0]![0])).toContain("viacep.com.br/ws/02307000");
    const search = new URL(String(fetchMock.mock.calls[1]![0])).searchParams;
    expect(search.get("street")).toBe("246 Rua Caranguejo");
    expect(search.get("city")).toBe("São Paulo");
    expect(search.get("postalcode")).toBe("02307-000");
  });

  it("recusa rua homônima em outra cidade e cai para o bairro do CEP", async () => {
    const guarulhos = nominatimResponse([
      { lat: "-23.40", lon: "-46.49", city: "Guarulhos" },
    ]);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(viaCepCaranguejo))
      .mockResolvedValueOnce(guarulhos)
      .mockResolvedValueOnce(
        nominatimResponse([{ lat: "-23.40", lon: "-46.49", city: "Guarulhos" }]),
      )
      .mockResolvedValueOnce(
        nominatimResponse([{ lat: "-23.48", lon: "-46.60", city: "São Paulo" }]),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await resolveAddress("Rua Caranguejo, 246, 02307-000");
    expect(result).toMatchObject({ lat: -23.48, lng: -46.6 });
    const last = new URL(String(fetchMock.mock.calls[3]![0])).searchParams;
    expect(last.get("q")).toBe("Tucuruvi, São Paulo, SP");
  });

  it("tenta sem o número da casa e salva sem coordenadas se nada for achado", async () => {
    const fetchMock = vi.fn().mockResolvedValue(nominatimResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    expect(await resolveAddress("Rua Inexistente, 42, Lugar Nenhum")).toEqual({
      address: "Rua Inexistente, 42, Lugar Nenhum",
      lat: null,
      lng: null,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1]![0])).not.toContain("42");
  });

  it("apagar o endereço limpa as coordenadas", async () => {
    expect(
      await resolveAddress("", { address: "Rua A", lat: 1, lng: 2 }),
    ).toEqual({ address: null, lat: null, lng: null });
  });
});
