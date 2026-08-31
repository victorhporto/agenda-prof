import { AssistenteClient } from "@/components/AssistenteClient";
import { createClient } from "@/lib/supabase/server";

export default async function AssistentePage() {
  const supabase = await createClient();
  const { data: students } = await supabase
    .from("students")
    .select("id, name")
    .order("name", { ascending: true });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Assistente
        </h1>
        <p className="mt-1 text-[var(--ink-muted)]">
          Informe a disponibilidade do aluno e a sua. O assistente lê a grade
          da semana e sugere um encaixe — sem alterar a agenda.
        </p>
      </div>
      <AssistenteClient students={students ?? []} />
    </div>
  );
}
