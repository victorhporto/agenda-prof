import { createClient } from "@/lib/supabase/server";
import { StudentForm } from "@/components/StudentForm";
import { DeleteStudentButton } from "@/components/DeleteStudentButton";

export default async function AlunosPage() {
  const supabase = await createClient();
  const { data: students } = await supabase
    .from("students")
    .select("*")
    .order("name", { ascending: true });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">
            Alunos
          </h1>
          <p className="mt-1 text-[var(--ink-muted)]">
            Cadastre quem compra seus pacotes de aulas.
          </p>
        </div>
        <StudentForm />
      </div>

      {!students?.length ? (
        <div className="panel p-8 text-center">
          <p className="font-medium">Nenhum aluno ainda</p>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">
            Comece cadastrando o primeiro aluno.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {students.map((student) => (
            <li key={student.id} className="panel flex items-start justify-between gap-3 p-4">
              <div>
                <p className="font-semibold">{student.name}</p>
                {student.phone && (
                  <p className="text-sm text-[var(--ink-muted)]">
                    {student.phone}
                  </p>
                )}
                {student.notes && (
                  <p className="mt-1 text-sm text-[var(--ink-muted)]">
                    {student.notes}
                  </p>
                )}
              </div>
              <DeleteStudentButton id={student.id} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
