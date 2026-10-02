"use client";

import { useEffect, useRef, useState } from "react";
import {
  BRAZIL_STATES,
  EMPTY_ADDRESS,
  cepDigits,
  formatCep,
  type AddressParts,
} from "@/lib/geo/address";

type CepStatus = "idle" | "loading" | "found" | "not_found" | "error";

async function fetchViaCep(digits: string) {
  const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
  if (!response.ok) throw new Error("ViaCEP indisponível");
  const data = (await response.json()) as {
    erro?: unknown;
    logradouro?: string;
    bairro?: string;
    localidade?: string;
    uf?: string;
  };
  if (data.erro || !data.localidade) return null;
  return data;
}

/**
 * Endereço em campos. Com `namePrefix`, os inputs entram no FormData do
 * formulário (ex.: address_cep); com `onChange`, o pai recebe as partes.
 */
export function AddressFields({
  namePrefix,
  defaultValue,
  onChange,
  legend = "Endereço",
  hint = "Usado para estimar o deslocamento em aulas na casa do aluno.",
}: {
  namePrefix?: string;
  defaultValue?: AddressParts;
  onChange?: (parts: AddressParts) => void;
  legend?: string;
  hint?: string;
}) {
  const [parts, setParts] = useState<AddressParts>(
    defaultValue ?? EMPTY_ADDRESS,
  );
  const initialCep = cepDigits(defaultValue?.cep ?? "");
  const needsInitialLookup = initialCep.length === 8 && !defaultValue?.city;
  const [status, setStatus] = useState<CepStatus>(
    needsInitialLookup ? "loading" : "idle",
  );
  const numberRef = useRef<HTMLInputElement>(null);
  const lookedUp = useRef<string | null>(null);

  function update(next: AddressParts) {
    setParts(next);
    onChange?.(next);
  }

  function lookup(digits: string, base: AddressParts, focusNumber: boolean) {
    lookedUp.current = digits;
    return fetchViaCep(digits).then(
      (data) => {
        if (lookedUp.current !== digits) return;
        if (!data) {
          setStatus("not_found");
          return;
        }
        update({
          ...base,
          street: data.logradouro || base.street,
          neighborhood: data.bairro || base.neighborhood,
          city: data.localidade || base.city,
          state: data.uf || base.state,
        });
        setStatus("found");
        if (focusNumber && !base.number) numberRef.current?.focus();
      },
      () => {
        if (lookedUp.current === digits) setStatus("error");
      },
    );
  }

  useEffect(() => {
    if (needsInitialLookup) void lookup(initialCep, defaultValue!, false);
    // Só completa uma vez endereços antigos que vieram sem cidade.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onCepChange(value: string) {
    const next = { ...parts, cep: formatCep(value) };
    update(next);
    const digits = cepDigits(value);
    if (digits.length === 8 && digits !== lookedUp.current) {
      setStatus("loading");
      void lookup(digits, next, true);
    } else if (digits.length < 8) {
      lookedUp.current = null;
      setStatus("idle");
    }
  }

  function field(key: keyof AddressParts) {
    return {
      name: namePrefix ? `${namePrefix}${key}` : undefined,
      value: parts[key],
      onChange: (event: { target: { value: string } }) =>
        update({ ...parts, [key]: event.target.value }),
    };
  }

  const cepMessage: Record<CepStatus, string | null> = {
    idle: null,
    loading: "Buscando CEP...",
    found: null,
    not_found: "CEP não encontrado. Preencha o endereço manualmente.",
    error: "Não foi possível consultar o CEP agora. Preencha manualmente.",
  };

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium text-[var(--ink-muted)]">
        {legend}
      </legend>

      <label className="block text-sm font-medium text-[var(--ink-muted)]">
        CEP
        <input
          name={namePrefix ? `${namePrefix}cep` : undefined}
          value={parts.cep}
          onChange={(event) => onCepChange(event.target.value)}
          inputMode="numeric"
          autoComplete="postal-code"
          placeholder="00000-000"
          maxLength={9}
          className="input mt-1 max-w-[10rem]"
        />
        {cepMessage[status] ? (
          <span
            className={`mt-1 block text-xs font-normal ${status === "loading" ? "" : "text-[var(--warning)]"}`}
          >
            {cepMessage[status]}
          </span>
        ) : null}
      </label>

      <label className="block text-sm font-medium text-[var(--ink-muted)]">
        Rua
        <input
          {...field("street")}
          autoComplete="address-line1"
          maxLength={150}
          className="input mt-1"
        />
      </label>

      <div className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)] gap-3">
        <label className="block text-sm font-medium text-[var(--ink-muted)]">
          Número
          <input
            {...field("number")}
            ref={numberRef}
            maxLength={20}
            placeholder="s/n"
            className="input mt-1"
          />
        </label>
        <label className="block text-sm font-medium text-[var(--ink-muted)]">
          Complemento
          <input
            {...field("complement")}
            autoComplete="address-line2"
            maxLength={80}
            placeholder="Apto, bloco..."
            className="input mt-1"
          />
        </label>
      </div>

      <label className="block text-sm font-medium text-[var(--ink-muted)]">
        Bairro
        <input {...field("neighborhood")} maxLength={100} className="input mt-1" />
      </label>

      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,6rem)] gap-3">
        <label className="block text-sm font-medium text-[var(--ink-muted)]">
          Cidade
          <input
            {...field("city")}
            autoComplete="address-level2"
            maxLength={100}
            className="input mt-1"
          />
        </label>
        <label className="block text-sm font-medium text-[var(--ink-muted)]">
          UF
          <select {...field("state")} className="input mt-1">
            <option value="">—</option>
            {BRAZIL_STATES.map((uf) => (
              <option key={uf} value={uf}>
                {uf}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="text-xs text-[var(--ink-muted)]">
        {hint} Opcional. Localização por{" "}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          © OpenStreetMap
        </a>
        .
      </p>
    </fieldset>
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
