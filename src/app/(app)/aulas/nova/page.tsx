import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { LessonForm } from "@/components/LessonForm";
import { getPackageProgress } from "@/lib/package-progress";

type Props = { searchParams: Promise<{ package?: string }> };

export default async function NovaAulaPage({ searchParams }: Props) {
  const { package: packageId } = await searchParams;
  const supabase = await createClient();

  const { data: packages } = await supabase
    .from("lesson_packages")
    .select(
      `
      id,
      title,
      total_lessons,
      status,
      students ( name ),
      lessons ( status )
    `,
    )
    .eq("status", "active")
    .order("created_at", { ascending: false });

  const options =
    packages
      ?.map((pkg) => {
        const progress = getPackageProgress(pkg, pkg.lessons ?? []);
        const student = pkg.students as { name: string } | null;
        return {
          id: pkg.id,
          title: pkg.title,
          studentName: student?.name ?? "Aluno",
          remainingSlots: Math.max(
            pkg.total_lessons - progress.completed - progress.scheduled,
            0,
          ),
        };
      })
      .filter((p) => p.remainingSlots > 0) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/agenda"
          className="text-sm font-medium text-[var(--accent)]"
        >
          ← Agenda
        </Link>
        <h1 className="font-display mt-2 text-3xl font-bold tracking-tight">
          Agendar aula
        </h1>
        <p className="mt-1 text-[var(--ink-muted)]">
          Escolha a data ou repita semanalmente para preencher o pacote no mesmo
          dia e horário.
        </p>
      </div>
      <LessonForm packages={options} defaultPackageId={packageId} />
    </div>
  );
}
