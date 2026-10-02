"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AddressField, AddressLine } from "@/components/AddressField";
import { updateBaseAddress } from "@/lib/profile/actions";

export function BaseAddressForm({
  initialAddress,
  initialLat,
}: {
  initialAddress: string | null;
  initialLat: number | null;
}) {
  const router = useRouter();
  const [address, setAddress] = useState(initialAddress ?? "");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await updateBaseAddress(address);
      if ("error" in result) {
        setError(result.error ?? "Não foi possível salvar");
        return;
      }
      setMessage(
        result.located
          ? "Endereço salvo."
          : "Endereço salvo, mas não foi localizado no mapa. Confira rua, número e cidade.",
      );
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="panel space-y-4 p-5">
      <div>
        <h2 className="text-lg font-semibold">Ponto de partida</h2>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          De onde você sai para a primeira aula e para onde volta depois da
          última. Aulas online e na sua casa contam como estar aqui.
        </p>
      </div>

      <AddressField
        value={address}
        onChange={setAddress}
        label="Seu endereço"
        hint="Usado para estimar o deslocamento até a casa dos alunos."
      />
      <AddressLine address={initialAddress} lat={initialLat} />

      {error && <p className="form-error">{error}</p>}
      {message && (
        <p className="text-sm font-medium text-[var(--accent)]">{message}</p>
      )}

      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "Localizando..." : "Salvar endereço"}
      </button>
    </form>
  );
}
