import Link from "next/link";
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
                <Link
                  href={`/pacotes/${pkg.id}`}
                  className="panel block p-4 transition hover:border-[var(--accent)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold">{pkg.title}</p>
                      <p className="text-sm text-[var(--ink-muted)]">
                        {student?.name}
                      </p>
                    </div>
                    <span
                      className={`badge ${
                        pkg.status === "active"
                          ? "badge-completed"
                          : "badge-cancelled"
                      }`}
                    >
                      {pkg.status === "active" ? "Ativo" : "Encerrado"}
                    </span>
                  </div>
                  <div className="mt-3">
                    <div className="mb-1 flex justify-between text-sm">
                      <span>
                        {progress.completed} de {pkg.total_lessons} dadas
                      </span>
                      <span className="text-[var(--ink-muted)]">
                        {progress.remaining} restantes
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[var(--bg)]">
                      <div
                        className="h-full rounded-full bg-[var(--accent)] transition-all"
                        style={{
                          width: `${Math.min(
                            100,
                            (progress.completed / pkg.total_lessons) * 100,
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
