"use client";

import { useState } from "react";
import type { Coordinates } from "@/lib/geo/geocode";
import {
  ninetyNineRideUrl,
  uberRideUrl,
  type RideDestination,
} from "@/lib/geo/rides";

function currentPosition(): Promise<Coordinates | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 60_000 },
    );
  });
}

export function RideButtons({
  destination,
  base,
}: {
  destination: RideDestination;
  base: Coordinates | null;
}) {
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function openNinetyNine() {
    setMessage(null);
    setLocating(true);
    const here = await currentPosition();
    setLocating(false);
    const pickup = here
      ? { ...here, title: "Minha localização" }
      : base
        ? { ...base, title: "Ponto de partida" }
        : null;
    if (!pickup) {
      setMessage(
        "O 99 precisa do ponto de partida: permita a localização ou cadastre seu endereço no perfil.",
      );
      return;
    }
    window.location.href = ninetyNineRideUrl(pickup, destination);
    window.setTimeout(() => {
      if (document.visibilityState === "visible") {
        setMessage("Se o 99 não abriu, confira se o app está instalado neste aparelho.");
      }
    }, 2000);
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-[var(--ink-muted)]">Ir até o aluno</p>
      <div className="flex flex-wrap gap-2">
        <a
          href={uberRideUrl(destination)}
          target="_blank"
          rel="noreferrer"
          className="btn-secondary px-4 py-2 text-sm"
        >
          Chamar Uber
        </a>
        <button
          type="button"
          onClick={openNinetyNine}
          disabled={locating}
          className="btn-secondary px-4 py-2 text-sm"
        >
          {locating ? "Localizando..." : "Chamar 99"}
        </button>
      </div>
      {message && <p className="text-xs text-[var(--warning)]">{message}</p>}
    </div>
  );
}
