import Link from "next/link";
import { PackageListItem } from "@/components/PackageListItem";
import { createClient } from "@/lib/supabase/server";
import { getPackageProgress } from "@/lib/package-progress";

type SearchParams = Promise<{ status?: string }>;
type PackageStatusFilter = "active" | "closed";

function resolveStatus(raw: string | undefined): PackageStatusFilter {
  if (raw === "closed") return "closed";
  return "active";
}

export default async function PacotesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const filter = resolveStatus(params.status);
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

  const allPackages = packages ?? [];
  const activeCount = allPackages.filter((pkg) => pkg.status === "active").length;
  const closedCount = allPackages.filter((pkg) => pkg.status === "closed").length;
  const visiblePackages = allPackages.filter((pkg) => pkg.status === filter);

  const tabs: { key: PackageStatusFilter; label: string; count: number }[] = [
    { key: "active", label: "Ativos", count: activeCount },
    { key: "closed", label: "Encerrados", count: closedCount },
  ];

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

      {!allPackages.length ? (
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
        <>
          <div className="inline-flex flex-wrap rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1">
            {tabs.map((item) => {
              const href =
                item.key === "active" ? "/pacotes" : "/pacotes?status=closed";
              const selected = filter === item.key;
              return (
                <Link
                  key={item.key}
                  href={href}
                  aria-current={selected ? "page" : undefined}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                    selected
                      ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                      : "text-[var(--ink-muted)]"
                  }`}
                >
                  {item.label} ({item.count})
                </Link>
              );
            })}
          </div>

          {!visiblePackages.length ? (
            <div className="panel p-8 text-center">
              <p className="font-medium">
                {filter === "active"
                  ? "Nenhum pacote ativo"
                  : "Nenhum pacote encerrado"}
              </p>
              <p className="mt-1 text-sm text-[var(--ink-muted)]">
                {filter === "active"
                  ? "Crie um pacote ou reabra um encerrado para vê-lo aqui."
                  : "Pacotes encerrados aparecem nesta aba."}
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {visiblePackages.map((pkg) => {
                const progress = getPackageProgress(pkg, pkg.lessons ?? []);
                const student = pkg.students as { name: string } | null;
                return (
                  <li key={pkg.id}>
                    <PackageListItem
                      pkg={pkg}
                      progress={progress}
                      studentName={student?.name}
                      showRepeat={filter === "closed"}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
