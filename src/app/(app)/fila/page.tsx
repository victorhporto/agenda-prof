import { createClient } from "@/lib/supabase/server";
import { WaitlistForm } from "@/components/WaitlistForm";
import { WaitlistCard } from "@/components/WaitlistCard";

export default async function FilaPage() {
  const supabase = await createClient();
  const { data: entries } = await supabase
    .from("waitlist_entries")
    .select(
      "id, name, contact, location, available_slots, created_at, address, address_parts, lat",
    )
    .order("created_at", { ascending: true });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">
            Fila de espera
          </h1>
          <p className="mt-1 text-[var(--ink-muted)]">
            Quem pediu aula e ainda não entrou na agenda. O primeiro da lista é
            quem chegou primeiro.
          </p>
        </div>
        <WaitlistForm />
      </div>

      {!entries?.length ? (
        <div className="panel p-8 text-center">
          <p className="font-medium">Fila vazia</p>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">
            Cadastre nome, contato, local e horários de quem está esperando
            uma vaga.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {entries.map((entry, index) => (
            <WaitlistCard
              key={entry.id}
              position={index + 1}
              entry={entry}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
