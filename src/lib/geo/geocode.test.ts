import { afterEach, describe, expect, it, vi } from "vitest";
import { expandStreet, resolveAddressParts } from "@/lib/geo/geocode";
import { toAddressParts } from "@/lib/geo/address";

type FakeResult = { lat: string; lon: string; city?: string };

function nominatimResponse(results: FakeResult[]) {
  return new Response(
    JSON.stringify(
      results.map(({ city, ...rest }) => ({
        ...rest,
        address: city ? { city } : {},
      })),
    ),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

const caranguejo = toAddressParts({
  cep: "02307000",
  street: "Rua Caranguejo",
  number: "246",
  neighborhood: "Tucuruvi",
  city: "São Paulo",
  state: "SP",
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("expandStreet", () => {
  it("expande abreviações comuns do tipo de logradouro", () => {
    expect(expandStreet("R. do Tramway")).toBe("Rua do Tramway");
    expect(expandStreet("Av. Conceição")).toBe("Avenida Conceição");
    expect(expandStreet("Rua Augusta")).toBe("Rua Augusta");
  });
});

describe("resolveAddressParts", () => {
  it("sem endereço limpa tudo", async () => {
    expect(await resolveAddressParts(null)).toEqual({
      address: null,
      lat: null,
      lng: null,
    });
  });

  it("reaproveita coordenadas quando o endereço não mudou", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const previous = {
      address: "Rua Caranguejo, 246 - Tucuruvi, São Paulo - SP, 02307-000",
      lat: -23.48,
      lng: -46.6,
    };
    expect(await resolveAddressParts(caranguejo, previous)).toEqual(previous);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("faz busca estruturada com número, cidade, UF e CEP", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        nominatimResponse([{ lat: "-23.47", lon: "-46.60", city: "São Paulo" }]),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await resolveAddressParts(caranguejo);
    expect(result).toEqual({
      address: "Rua Caranguejo, 246 - Tucuruvi, São Paulo - SP, 02307-000",
      lat: -23.47,
      lng: -46.6,
    });
    const [url, init] = fetchMock.mock.calls[0]!;
    const params = new URL(String(url)).searchParams;
    expect(params.get("street")).toBe("246 Rua Caranguejo");
    expect(params.get("city")).toBe("São Paulo");
    expect(params.get("state")).toBe("SP");
    expect(params.get("postalcode")).toBe("02307-000");
    expect(init.headers["User-Agent"]).toMatch(/^AgendaProf/);
  });

  it("recusa rua homônima em outra cidade e cai para o bairro", async () => {
    const guarulhos = () =>
      nominatimResponse([{ lat: "-23.40", lon: "-46.49", city: "Guarulhos" }]);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(guarulhos())
      .mockResolvedValueOnce(guarulhos())
      .mockResolvedValueOnce(
        nominatimResponse([{ lat: "-23.48", lon: "-46.60", city: "São Paulo" }]),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await resolveAddressParts(caranguejo);
    expect(result).toMatchObject({ lat: -23.48, lng: -46.6 });
    const last = new URL(String(fetchMock.mock.calls[2]![0])).searchParams;
    expect(last.get("q")).toBe("Tucuruvi, São Paulo, SP");
  });

  it("salva sem coordenadas quando nada é encontrado", async () => {
    const fetchMock = vi.fn(async () => nominatimResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    const result = await resolveAddressParts(caranguejo);
    expect(result.lat).toBeNull();
    expect(result.address).toContain("Rua Caranguejo");
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});
