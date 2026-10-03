"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  deleteWaitlistEntry,
  updateWaitlistEntry,
} from "@/lib/waitlist/actions";
import { LocationRadios } from "@/components/LocationRadios";
import { StudentSlotsEditor } from "@/components/StudentSlotsEditor";
import {
  AddressFields,
  AddressLine,
  BaseLocationNote,
} from "@/components/AddressField";
import { storedAddressParts, type AddressParts } from "@/lib/geo/address";
import {
  LOCATION_SHORT,
  parseStoredLocation,
  type LessonLocation,
} from "@/lib/lessons/location";
import {
  formatStudentSlots,
  studentSlotsFromStored,
  type StudentSlot,
} from "@/lib/assistente/occupancy";
import { formatInSaoPaulo } from "@/lib/timezone";
import { toWhatsAppNumber, whatsappUrl } from "@/lib/whatsapp";

export type WaitlistEntryView = {
  id: string;
  name: string;
  contact: string;
  location: string;
  available_slots: unknown;
  created_at: string;
  address: string | null;
  address_parts: unknown;
  lat: number | null;
};

export function WaitlistCard({
  entry,
  position,
}: {
  entry: WaitlistEntryView;
  position: number;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(entry.name);
  const [contact, setContact] = useState(entry.contact);
  const [location, setLocation] = useState<LessonLocation>(
    () => parseStoredLocation(entry.location) ?? "online",
  );
  const [address, setAddress] = useState<AddressParts>(() =>
    storedAddressParts(entry.address_parts, entry.address),
  );
  const [slots, setSlots] = useState<StudentSlot[]>(() =>
    studentSlotsFromStored(entry.available_slots),
  );

  const locationLabel = parseStoredLocation(entry.location);
  const storedSlots = studentSlotsFromStored(entry.available_slots);
  const whatsapp = toWhatsAppNumber(entry.contact);
  const chatUrl = whatsapp
    ? whatsappUrl(entry.contact, `Olá, ${entry.name}!`)
    : null;

  function onSave() {
    setError(null);
    startTransition(async () => {
      const result = await updateWaitlistEntry(entry.id, {
        name,
        contact,
        location,
        slots,
        ...(location === "casa_aluno" ? { address } : {}),
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setEditing(false);
      router.refresh();
    });
  }

  function onRemove() {
    if (!confirm(`Remover ${entry.name} da fila de espera?`)) return;
    startTransition(async () => {
      await deleteWaitlistEntry(entry.id);
      router.refresh();
    });
  }

  if (editing) {
    return (
      <li className="panel space-y-3 p-4">
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            onSave();
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
            />
          </label>
          <LocationRadios
            name={`waitlist_location_${entry.id}`}
            legend="Preferência de local"
            value={location}
            onChange={setLocation}
          />
          {location === "casa_aluno" ? (
            <AddressFields defaultValue={address} onChange={setAddress} />
          ) : (
            <BaseLocationNote location={location} />
          )}
          <StudentSlotsEditor value={slots} onChange={setSlots} />
          {error && <p className="form-error">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={pending} className="btn-primary">
              {pending ? "Salvando..." : "Salvar"}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setName(entry.name);
                setContact(entry.contact);
                setLocation(parseStoredLocation(entry.location) ?? "online");
                setAddress(storedAddressParts(entry.address_parts, entry.address));
                setSlots(studentSlotsFromStored(entry.available_slots));
                setError(null);
                setEditing(false);
              }}
            >
              Cancelar
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="panel p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="badge badge-scheduled">#{position}</span>
            <p className="font-semibold">{entry.name}</p>
          </div>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">{entry.contact}</p>
          {locationLabel ? (
            <p className="text-sm text-[var(--ink-muted)]">
              {LOCATION_SHORT[locationLabel]}
            </p>
          ) : null}
          <AddressLine address={entry.address} lat={entry.lat} />
          <p className="mt-2 text-sm">{formatStudentSlots(storedSlots)}</p>
          <p className="mt-1 text-xs text-[var(--ink-muted)]">
            Entrou em {formatInSaoPaulo(entry.created_at, "dd/MM 'às' HH:mm")}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <button
            type="button"
            className="text-sm font-medium text-[var(--accent)] hover:underline"
            onClick={() => {
              setName(entry.name);
              setContact(entry.contact);
              setLocation(parseStoredLocation(entry.location) ?? "online");
              setAddress(storedAddressParts(entry.address_parts, entry.address));
              setSlots(studentSlotsFromStored(entry.available_slots));
              setError(null);
              setEditing(true);
            }}
          >
            Editar
          </button>
          <button
            type="button"
            disabled={pending}
            className="text-sm font-medium text-[var(--danger)] hover:underline disabled:opacity-50"
            onClick={onRemove}
          >
            Remover
          </button>
        </div>
      </div>
      {chatUrl ? (
        <a
          href={chatUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex text-sm font-medium text-[var(--accent)] hover:underline"
        >
          Abrir WhatsApp
        </a>
      ) : null}
    </li>
  );
}
