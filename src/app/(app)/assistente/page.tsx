import Link from "next/link";
import { AssistenteClient } from "@/components/AssistenteClient";
import {
  RemanejarClient,
  type WeekStudent,
} from "@/components/RemanejarClient";
import { createClient } from "@/lib/supabase/server";
import { loadWeekOccupiedBlocks } from "@/lib/assistente/load";
import {
  teacherWindowsFromStored,
  type OccupiedBlock,
} from "@/lib/assistente/occupancy";
import { parseStoredLocation } from "@/lib/lessons/location";

type SearchParams = Promise<{ modo?: string }>;
type AssistenteMode = "novo" | "remanejar";

function groupWeekStudents(occupied: OccupiedBlock[]): WeekStudent[] {
  const byId = new Map<string, WeekStudent>();
  for (const block of occupied) {
    if (!block.studentId) continue;
    const student = byId.get(block.studentId) ?? {
      id: block.studentId,
      name: block.studentName,
      location: block.location,
      lessons: [],
      reserved: block.source === "reserva",
      projected: false,
      noActivePackage: false,
    };
    if (block.projected) student.projected = true;
    if (block.noActivePackage) student.noActivePackage = true;
    student.lessons.push({ weekday: block.weekday, time: block.start });
    byId.set(block.studentId, student);
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export default async function AssistentePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const mode: AssistenteMode = params.modo === "remanejar" ? "remanejar" : "novo";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [{ data: students }, { data: profile }, week] = await Promise.all([
    supabase
      .from("students")
      .select("id, name, default_location")
      .order("name", { ascending: true }),
    supabase
      .from("profiles")
      .select("teacher_windows")
      .eq("id", user!.id)
      .single(),
    mode === "remanejar"
      ? loadWeekOccupiedBlocks(supabase, user!.id).catch(() => null)
      : Promise.resolve(null),
  ]);
  const teacherWindows = teacherWindowsFromStored(profile?.teacher_windows);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Assistente
        </h1>
        <p className="mt-1 text-[var(--ink-muted)]">
          {mode === "novo"
            ? "Informe a disponibilidade do aluno. Seu horário vem do perfil — o assistente lê a grade ideal (horários reservados dos alunos) e sugere um encaixe, sem alterar a agenda."
            : "Escolha os alunos que vão mudar de horário. O assistente remonta a grade deles sem mexer nos demais e sem alterar a agenda."}
        </p>
      </div>

      <div className="flex rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1">
        {(
          [
            ["novo", "Novo aluno"],
            ["remanejar", "Remanejar alunos"],
          ] as const
        ).map(([value, label]) => (
          <Link
            key={value}
            href={value === "novo" ? "/assistente" : "/assistente?modo=remanejar"}
            className={`flex-1 rounded-lg px-3 py-2 text-center text-sm font-medium ${
              mode === value
                ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                : "text-[var(--ink-muted)]"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      {mode === "novo" ? (
        <AssistenteClient
          students={(students ?? []).map((student) => ({
            id: student.id,
            name: student.name,
            defaultLocation: parseStoredLocation(student.default_location),
          }))}
          initialTeacherWindows={teacherWindows}
        />
      ) : week ? (
        <RemanejarClient
          weekStudents={groupWeekStudents(week.occupied)}
          teacherWindows={teacherWindows}
          weekLabel={week.weekLabel}
          previousWeekLabel={week.previousWeekLabel}
        />
      ) : (
        <p className="form-error">Não foi possível ler a agenda dos próximos 7 dias.</p>
      )}
    </div>
  );
}
