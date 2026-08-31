import Link from "next/link";
import { notFound } from "next/navigation";
import { PackageListItem } from "@/components/PackageListItem";
import { ScrollToActivePackage } from "@/components/ScrollToActivePackage";
import { createClient } from "@/lib/supabase/server";
import { getPackageProgress } from "@/lib/package-progress";
import { LOCATION_SHORT, parseStoredLocation } from "@/lib/lessons/location";

type Props = { params: Promise<{ id: string }> };

export default async function AlunoDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: student } = await supabase
    .from("students")
    .select(
      `
      *,
      lesson_packages (
        *,
        lessons ( status )
      )
    `,
    )
    .eq("id", id)
    .single();

  if (!student) notFound();

  const packages = [...(student.lesson_packages ?? [])].sort((a, b) => {
    if (a.status === "active" && b.status !== "active") return -1;
    if (a.status !== "active" && b.status === "active") return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const activePackages = packages.filter((p) => p.status === "active");
  const historyPackages = packages.filter((p) => p.status !== "active");
  const focusActiveId = activePackages[0]?.id ?? null;
  const defaultLocation = parseStoredLocation(student.default_location);

  return (
    <div className="space-y-6">
      <ScrollToActivePackage activeId={focusActiveId} />

      <div>
        <Link
          href="/alunos"
          className="text-sm font-medium text-[var(--accent)]"
        >
          ← Alunos
        </Link>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">
              {student.name}
            </h1>
            {student.phone && (
              <p className="mt-1 text-[var(--ink-muted)]">{student.phone}</p>
            )}
            {defaultLocation && (
              <p className="mt-1 text-[var(--ink-muted)]">
                {LOCATION_SHORT[defaultLocation]}
              </p>
            )}
            {student.notes && (
              <p className="mt-2 text-sm text-[var(--ink-muted)]">
                {student.notes}
              </p>
            )}
          </div>
          <Link
            href={`/pacotes/novo?student=${student.id}`}
            className="btn-primary"
          >
            Novo pacote
          </Link>
        </div>
      </div>

      {!packages.length ? (
        <div className="panel p-8 text-center">
          <p className="font-medium">Nenhum pacote para este aluno</p>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">
            Crie o primeiro pacote para começar a agendar aulas.
          </p>
          <Link
            href={`/pacotes/novo?student=${student.id}`}
            className="btn-primary mt-4 inline-flex"
          >
            Criar pacote
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {activePackages.length > 0 && (
            <section>
              <h2 className="mb-3 text-lg font-semibold">
                Pacote{activePackages.length > 1 ? "s" : ""} ativo
                {activePackages.length > 1 ? "s" : ""}
              </h2>
              <ul className="space-y-3">
                {activePackages.map((pkg) => {
                  const progress = getPackageProgress(pkg, pkg.lessons ?? []);
                  return (
                    <li key={pkg.id}>
                      <PackageListItem
                        pkg={pkg}
                        progress={progress}
                        highlighted
                      />
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {historyPackages.length > 0 && (
            <section>
              <h2 className="mb-3 text-lg font-semibold">Histórico</h2>
              <ul className="space-y-3">
                {historyPackages.map((pkg) => {
                  const progress = getPackageProgress(pkg, pkg.lessons ?? []);
                  return (
                    <li key={pkg.id}>
                      <PackageListItem
                        pkg={pkg}
                        progress={progress}
                        showRepeat
                      />
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
