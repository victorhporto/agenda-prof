import { describe, expect, it } from "vitest";
import {
  addressPartsFromFormData,
  composeAddress,
  formatCep,
  parseAddressParts,
  partsFromLegacyText,
  storedAddressParts,
  toAddressParts,
} from "@/lib/geo/address";

describe("formatCep", () => {
  it("mascara enquanto digita", () => {
    expect(formatCep("02307")).toBe("02307");
    expect(formatCep("023070")).toBe("02307-0");
    expect(formatCep("02307-000")).toBe("02307-000");
    expect(formatCep("02.307-0001")).toBe("02307-000");
  });
});

describe("parseAddressParts", () => {
  it("tudo vazio significa sem endereço", () => {
    expect(parseAddressParts({ cep: " ", street: "" })).toEqual({
      ok: true,
      value: null,
    });
  });

  it("exige rua, cidade e UF válida; CEP completo quando informado", () => {
    const base = { street: "Rua A", city: "São Paulo", state: "sp" };
    expect(parseAddressParts(base)).toMatchObject({
      ok: true,
      value: { state: "SP" },
    });
    expect(parseAddressParts({ ...base, street: "" }).ok).toBe(false);
    expect(parseAddressParts({ ...base, city: "" }).ok).toBe(false);
    expect(parseAddressParts({ ...base, state: "XX" }).ok).toBe(false);
    expect(parseAddressParts({ ...base, cep: "0230" }).ok).toBe(false);
  });
});

describe("composeAddress", () => {
  it("monta o endereço completo e omite o que falta", () => {
    expect(
      composeAddress(
        toAddressParts({
          cep: "02072000",
          street: "Avenida Conceição",
          number: "254",
          complement: "Apto 12",
          neighborhood: "Carandiru",
          city: "São Paulo",
          state: "SP",
        }),
      ),
    ).toBe(
      "Avenida Conceição, 254 - Apto 12 - Carandiru, São Paulo - SP, 02072-000",
    );
    expect(
      composeAddress(
        toAddressParts({ street: "Rua A", city: "Santos", state: "SP" }),
      ),
    ).toBe("Rua A, Santos - SP");
  });
});

describe("addressPartsFromFormData", () => {
  it("lê os campos com prefixo", () => {
    const form = new FormData();
    form.set("address_cep", "02303080");
    form.set("address_street", " Rua do Tramway ");
    form.set("address_state", "sp");
    expect(addressPartsFromFormData(form)).toMatchObject({
      cep: "02303-080",
      street: "Rua do Tramway",
      state: "SP",
      city: "",
    });
  });
});

describe("endereços antigos em texto livre", () => {
  it("aproveita CEP, rua e número do texto copiado do Google Maps", () => {
    expect(
      partsFromLegacyText(
        "R. do Tramway, 400-454 - Tucuruvi São Paulo - SP, 02303-080",
      ),
    ).toMatchObject({ cep: "02303-080", street: "R. do Tramway", number: "400" });
  });

  it("prefere as partes salvas quando existem", () => {
    expect(
      storedAddressParts({ street: "Rua Nova", city: "X", state: "SP" }, "Rua Velha, 1"),
    ).toMatchObject({ street: "Rua Nova" });
    expect(storedAddressParts(null, "Rua Velha, 1")).toMatchObject({
      street: "Rua Velha",
      number: "1",
    });
  });
});
