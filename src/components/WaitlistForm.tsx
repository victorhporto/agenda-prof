"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createWaitlistEntry } from "@/lib/waitlist/actions";
import { LocationRadios } from "@/components/LocationRadios";
import { StudentSlotsEditor } from "@/components/StudentSlotsEditor";
import { AddressField } from "@/components/AddressField";
import type { LessonLocation } from "@/lib/lessons/location";
import type { StudentSlot } from "@/lib/assistente/occupancy";

function emptySlot(): StudentSlot {
  return { weekday: 1, time: "" };
}

export function WaitlistForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [location, setLocation] = useState<LessonLocation>("online");
  const [address, setAddress] = useState("");
  const [slots, setSlots] = useState<StudentSlot[]>([emptySlot()]);

  function reset() {
    setName("");
    setContact("");
    setLocation("online");
    setAddress("");
    setSlots([emptySlot()]);
    setError(null);
  }

  function onSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await createWaitlistEntry({
        name,
        contact,
        location,
        slots,
        address,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      reset();
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        className="btn-primary"
        onClick={() => setOpen(true)}
      >
        Entrar na fila
      </button>
    );
  }

  return (
    <form
      className="panel space-y-3 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <label className="block text-sm font-medium text-[var(--ink-muted)]">
        Nome
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          className="input mt-1"
        />
      </label>
      <label className="block text-sm font-medium text-[var(--ink-muted)]">
        Contato
        <input
          value={contact}
          onChange={(event) => setContact(event.target.value)}
          required
          className="input mt-1"
          placeholder="WhatsApp, telefone ou e-mail"
        />
      </label>
      <LocationRadios
        name="waitlist_location"
        legend="Preferência de local"
        value={location}
        onChange={setLocation}
      />
      <AddressField value={address} onChange={setAddress} />
      <StudentSlotsEditor value={slots} onChange={setSlots} />
      {error && <p className="form-error">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Salvando..." : "Salvar na fila"}
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => {
            reset();
            setOpen(false);
          }}
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
