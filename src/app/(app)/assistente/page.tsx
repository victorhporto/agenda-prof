import { AssistenteClient } from "@/components/AssistenteClient";
import { createClient } from "@/lib/supabase/server";
import { teacherWindowsFromStored } from "@/lib/assistente/occupancy";
import { parseStoredLocation } from "@/lib/lessons/location";

export default async function AssistentePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [{ data: students }, { data: profile }] = await Promise.all([
    supabase
      .from("students")
      .select("id, name, default_location")
      .order("name", { ascending: true }),
    supabase
      .from("profiles")
      .select("teacher_windows")
      .eq("id", user!.id)
      .single(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Assistente
        </h1>
        <p className="mt-1 text-[var(--ink-muted)]">
          Informe a disponibilidade do aluno. Seu horário vem do perfil — o
          assistente lê a grade da semana e sugere um encaixe, sem alterar a
          agenda.
        </p>
      </div>
      <AssistenteClient
        students={(students ?? []).map((student) => ({
          id: student.id,
          name: student.name,
          defaultLocation: parseStoredLocation(student.default_location),
        }))}
        initialTeacherWindows={teacherWindowsFromStored(profile?.teacher_windows)}
      />
    </div>
  );
}
