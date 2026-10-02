import { createClient } from "@/lib/supabase/server";
import { TeacherAvailabilityForm } from "@/components/TeacherAvailabilityForm";
import { BaseAddressForm } from "@/components/BaseAddressForm";
import {
  parseTeacherWindows,
  teacherWindowsFromStored,
} from "@/lib/assistente/occupancy";

export default async function PerfilPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, teacher_windows, base_address, base_lat")
    .eq("id", user!.id)
    .single();

  const stored = parseTeacherWindows(profile?.teacher_windows);
  const windows = teacherWindowsFromStored(profile?.teacher_windows);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Perfil
        </h1>
        <p className="mt-1 text-[var(--ink-muted)]">
          {profile?.full_name
            ? `${profile.full_name} — disponibilidade permanente para o Assistente e os horários livres.`
            : "Disponibilidade permanente para o Assistente e os horários livres."}
        </p>
      </div>

      <TeacherAvailabilityForm
        initialWindows={windows}
        saved={stored.ok}
      />

      <BaseAddressForm
        initialAddress={profile?.base_address ?? null}
        initialLat={profile?.base_lat ?? null}
      />
    </div>
  );
}
