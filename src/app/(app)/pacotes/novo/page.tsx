import Link from "next/link";
import { notFound } from "next/navigation";
import { PackageForm } from "@/components/PackageForm";
import { createClient } from "@/lib/supabase/server";

type Props = {
  searchParams: Promise<{ student?: string; copy?: string }>;
};

export default async function NovoPacotePage({ searchParams }: Props) {
  const { student: studentId, copy: copyId } = await searchParams;
  const supabase = await createClient();

  const { data: students } = await supabase
    .from("students")
    .select("id, name")
    .order("name");

  let defaultStudentId = studentId;
  let prefill: { title: string; total_lessons: number; price: number | null } | undefined;

  if (copyId) {
    const { data: source } = await supabase
      .from("lesson_packages")
      .select("student_id, title, total_lessons, price")
      .eq("id", copyId)
      .single();

    if (!source) notFound();

    defaultStudentId = defaultStudentId ?? source.student_id;
    prefill = {
      title: source.title,
      total_lessons: source.total_lessons,
      price: source.price,
    };
  }

  const backHref = defaultStudentId
    ? `/alunos/${defaultStudentId}`
    : "/pacotes";

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={backHref}
          className="text-sm font-medium text-[var(--accent)]"
        >
          ← {defaultStudentId ? "Aluno" : "Pacotes"}
        </Link>
        <h1 className="font-display mt-2 text-3xl font-bold tracking-tight">
          {prefill ? "Repetir pacote" : "Novo pacote"}
        </h1>
        {prefill && (
          <p className="mt-1 text-sm text-[var(--ink-muted)]">
            Dados copiados do pacote anterior. Revise antes de criar.
          </p>
        )}
      </div>

      {!students?.length ? (
        <div className="panel p-6">
          <p className="font-medium">Cadastre um aluno primeiro</p>
          <Link href="/alunos" className="btn-primary mt-4 inline-flex">
            Ir para alunos
          </Link>
        </div>
      ) : (
        <PackageForm
          students={students}
          defaultStudentId={defaultStudentId}
          prefill={prefill}
        />
      )}
    </div>
  );
}
