import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PackageForm } from "@/components/PackageForm";

export default async function NovoPacotePage() {
  const supabase = await createClient();
  const { data: students } = await supabase
    .from("students")
    .select("id, name")
    .order("name");

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/pacotes"
          className="text-sm font-medium text-[var(--accent)]"
        >
          ← Pacotes
        </Link>
        <h1 className="font-display mt-2 text-3xl font-bold tracking-tight">
          Novo pacote
        </h1>
      </div>

      {!students?.length ? (
        <div className="panel p-6">
          <p className="font-medium">Cadastre um aluno primeiro</p>
          <Link href="/alunos" className="btn-primary mt-4 inline-flex">
            Ir para alunos
          </Link>
        </div>
      ) : (
        <PackageForm students={students} />
      )}
    </div>
  );
}
