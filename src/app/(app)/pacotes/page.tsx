import Link from "next/link";
import { PackageListItem } from "@/components/PackageListItem";
import { createClient } from "@/lib/supabase/server";
import { getPackageProgress } from "@/lib/package-progress";

export default async function PacotesPage() {
  const supabase = await createClient();
  const { data: packages } = await supabase
    .from("lesson_packages")
    .select(
      `
      *,
      students ( name ),
      lessons ( status )
    `,
    )
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">
            Pacotes
          </h1>
          <p className="mt-1 text-[var(--ink-muted)]">
            Pacotes vendidos e saldo de aulas.
          </p>
        </div>
        <Link href="/pacotes/novo" className="btn-primary">
          Novo pacote
        </Link>
      </div>

      {!packages?.length ? (
        <div className="panel p-8 text-center">
          <p className="font-medium">Nenhum pacote cadastrado</p>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">
            Crie um pacote após cadastrar um aluno.
          </p>
          <Link href="/pacotes/novo" className="btn-primary mt-4 inline-flex">
            Criar pacote
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {packages.map((pkg) => {
            const progress = getPackageProgress(pkg, pkg.lessons ?? []);
            const student = pkg.students as { name: string } | null;
            return (
              <li key={pkg.id}>
                <PackageListItem
                  pkg={pkg}
                  progress={progress}
                  studentName={student?.name}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
