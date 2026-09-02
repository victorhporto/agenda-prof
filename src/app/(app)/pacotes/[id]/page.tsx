import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPackageProgress } from "@/lib/package-progress";
import { formatLessonDate, formatMoney, statusLabel } from "@/lib/utils";
import { LOCATION_SHORT, effectiveLocation } from "@/lib/lessons/location";
import { ClosePackageButton } from "@/components/ClosePackageButton";
import { EditPackagePanel } from "@/components/EditPackagePanel";
import { PaymentPanel } from "@/components/PaymentPanel";
import { ReopenPackageButton } from "@/components/ReopenPackageButton";
import { RepeatPackageButton } from "@/components/RepeatPackageButton";

type Props = { params: Promise<{ id: string }> };

export default async function PacoteDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: pkg } = await supabase
    .from("lesson_packages")
    .select(
      `
      *,
      students ( name, phone, default_location ),
      lessons ( id, scheduled_at, status, sequence_number, location )
    `,
    )
    .eq("id", id)
    .single();

  if (!pkg) notFound();

  const { data: paymentEntries } = await supabase
    .from("payment_entries")
    .select("id, amount, paid_at, method, notes")
    .eq("package_id", id)
    .order("paid_at", { ascending: false })
    .order("created_at", { ascending: false });

  const lessons = [...(pkg.lessons ?? [])].sort(
    (a, b) =>
      new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime(),
  );
  const progress = getPackageProgress(pkg, lessons);
  const student = pkg.students as {
    name: string;
    phone: string | null;
    default_location: string | null;
  } | null;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={pkg.status === "closed" ? "/pacotes?status=closed" : "/pacotes"}
          className="text-sm font-medium text-[var(--accent)]"
        >
          ← Pacotes
        </Link>
        <p className="mt-1">
          <Link
            href={`/alunos/${pkg.student_id}`}
            className="text-sm text-[var(--ink-muted)] hover:text-[var(--accent)]"
          >
            Ver todos os pacotes de {student?.name}
          </Link>
        </p>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">
              {pkg.title}
            </h1>
            <p className="mt-1 text-[var(--ink-muted)]">
              {student?.name}
              {student?.phone ? ` · ${student.phone}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {progress.canScheduleMore && pkg.status === "active" && (
              <Link
                href={`/aulas/nova?package=${pkg.id}`}
                className="btn-primary"
              >
                Agendar aula
              </Link>
            )}
            {pkg.status === "active" && (
              <ClosePackageButton
                packageId={pkg.id}
                scheduledCount={progress.scheduled}
              />
            )}
            {pkg.status === "closed" && (
              <>
                <RepeatPackageButton packageId={pkg.id} />
                <ReopenPackageButton packageId={pkg.id} />
              </>
            )}
          </div>
        </div>
      </div>

      <EditPackagePanel
        packageId={pkg.id}
        title={pkg.title}
        totalLessons={pkg.total_lessons}
        price={pkg.price}
        completedCount={progress.completed}
        scheduledCount={progress.scheduled}
      />

      <div className="panel p-5">
        <div className="mb-2 flex justify-between text-sm">
          <span className="font-medium">
            {progress.completed} de {pkg.total_lessons} aulas dadas
          </span>
          <span className="text-[var(--ink-muted)]">
            {progress.remaining} restantes · {progress.scheduled} agendada(s)
          </span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-[var(--bg)]">
          <div
            className="h-full rounded-full bg-[var(--accent)]"
            style={{
              width: `${Math.min(
                100,
                (progress.completed / pkg.total_lessons) * 100,
              )}%`,
            }}
          />
        </div>
        {pkg.price != null && (
          <p className="mt-3 text-sm text-[var(--ink-muted)]">
            Valor: {formatMoney(pkg.price)}
          </p>
        )}
        {!progress.canScheduleMore && pkg.status === "active" && (
          <p className="mt-3 rounded-lg bg-[var(--warning-soft)] px-3 py-2 text-sm text-[var(--warning)]">
            Todas as vagas do pacote já estão usadas (dadas + agendadas).
          </p>
        )}
      </div>

      <PaymentPanel
        packageId={pkg.id}
        price={pkg.price}
        paymentStatus={pkg.payment_status}
        amountPaid={Number(pkg.amount_paid ?? 0)}
        paymentNotes={pkg.payment_notes}
        paidAt={pkg.paid_at}
        paymentDueDate={pkg.payment_due_date}
        entries={(paymentEntries ?? []).map((entry) => ({
          id: entry.id,
          amount: Number(entry.amount),
          paid_at: entry.paid_at,
          method: entry.method,
          notes: entry.notes,
        }))}
      />

      <section>
        <h2 className="mb-3 text-lg font-semibold">Aulas</h2>
        {!lessons.length ? (
          <div className="panel p-6 text-center text-sm text-[var(--ink-muted)]">
            Nenhuma aula agendada neste pacote.
          </div>
        ) : (
          <ul className="space-y-2">
            {lessons.map((lesson) => (
              <li key={lesson.id}>
                <Link
                  href={`/aulas/${lesson.id}`}
                  className="panel flex items-center justify-between gap-3 p-3 transition hover:border-[var(--accent)]"
                >
                  <div>
                    <p className="font-medium capitalize">
                      {formatLessonDate(lesson.scheduled_at)}
                    </p>
                    {(() => {
                      const loc = effectiveLocation(
                        lesson.location,
                        student?.default_location,
                      );
                      const seq = lesson.sequence_number
                        ? `Aula ${lesson.sequence_number} de ${pkg.total_lessons}`
                        : null;
                      if (!seq && !loc) return null;
                      return (
                        <p className="text-sm text-[var(--ink-muted)]">
                          {[seq, loc ? LOCATION_SHORT[loc] : null]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      );
                    })()}
                  </div>
                  <span className={`badge badge-${lesson.status}`}>
                    {statusLabel(lesson.status)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
