import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getPackageProgress } from "@/lib/package-progress";
import { saoPauloDayBounds } from "@/lib/timezone";
import {
  formatDateOnly,
  formatLessonDate,
  formatMoney,
  isPaymentOverdue,
  packageBalance,
  paymentStatusLabel,
  statusLabel,
} from "@/lib/utils";

export default async function InicioPage() {
  const supabase = await createClient();
  const { start: dayStart, end: dayEnd, dayLabel: todayLabel } =
    saoPauloDayBounds();

  const [{ data: todayLessons }, { data: packages }] = await Promise.all([
    supabase
      .from("lessons")
      .select(
        `
        id,
        scheduled_at,
        status,
        lesson_packages (
          title,
          students ( name )
        )
      `,
      )
      .gte("scheduled_at", dayStart.toISOString())
      .lte("scheduled_at", dayEnd.toISOString())
      .order("scheduled_at", { ascending: true }),
    supabase
      .from("lesson_packages")
      .select(
        `
        id,
        title,
        price,
        amount_paid,
        payment_status,
        payment_due_date,
        total_lessons,
        status,
        students ( name ),
        lessons ( status )
      `,
      )
      .order("created_at", { ascending: false }),
  ]);

  const overduePayments = (packages ?? [])
    .filter((pkg) =>
      isPaymentOverdue(pkg.payment_status, pkg.payment_due_date),
    )
    .map((pkg) => {
      const balance = packageBalance(pkg);
      const student = pkg.students as { name: string } | null;
      return {
        id: pkg.id,
        title: pkg.title,
        studentName: student?.name ?? "Aluno",
        dueDate: pkg.payment_due_date,
        dueLabel: formatDateOnly(pkg.payment_due_date),
        dueAmount: balance.due,
        paymentStatus: pkg.payment_status,
      };
    })
    .sort((a, b) => {
      const da = a.dueDate
        ? new Date(`${a.dueDate.slice(0, 10)}T00:00:00`).getTime()
        : 0;
      const db = b.dueDate
        ? new Date(`${b.dueDate.slice(0, 10)}T00:00:00`).getTime()
        : 0;
      return da - db;
    });

  const endingPackages = (packages ?? [])
    .filter((pkg) => pkg.status === "active")
    .map((pkg) => {
      const progress = getPackageProgress(pkg, pkg.lessons ?? []);
      const student = pkg.students as { name: string } | null;
      return {
        id: pkg.id,
        title: pkg.title,
        studentName: student?.name ?? "Aluno",
        remaining: progress.remaining,
        completed: progress.completed,
        total: pkg.total_lessons,
      };
    })
    .filter((pkg) => pkg.remaining > 0 && pkg.remaining <= 1)
    .sort((a, b) => a.remaining - b.remaining);

  const pendingToday =
    todayLessons?.filter((lesson) => lesson.status === "scheduled").length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">
            Início
          </h1>
          <p className="mt-1 capitalize text-[var(--ink-muted)]">{todayLabel}</p>
        </div>
        <Link href="/aulas/nova" className="btn-primary">
          Nova aula
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="panel p-4">
          <p className="text-sm text-[var(--ink-muted)]">Aulas hoje</p>
          <p className="mt-1 text-2xl font-semibold">
            {todayLessons?.length ?? 0}
          </p>
          <p className="mt-1 text-xs text-[var(--ink-muted)]">
            {pendingToday} pendente{pendingToday === 1 ? "" : "s"} de OK
          </p>
        </div>
        <div className="panel p-4">
          <p className="text-sm text-[var(--ink-muted)]">Pagamentos atrasados</p>
          <p className="mt-1 text-2xl font-semibold text-[var(--danger)]">
            {overduePayments.length}
          </p>
          <Link
            href="/faturamento?status=overdue"
            className="mt-1 inline-block text-xs font-medium text-[var(--accent)]"
          >
            Ver faturamento →
          </Link>
        </div>
        <div className="panel p-4">
          <p className="text-sm text-[var(--ink-muted)]">Pacotes acabando</p>
          <p className="mt-1 text-2xl font-semibold text-[var(--warning)]">
            {endingPackages.length}
          </p>
          <p className="mt-1 text-xs text-[var(--ink-muted)]">
            1 aula restante ou menos
          </p>
        </div>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Agenda de hoje</h2>
          <Link
            href="/agenda"
            className="text-sm font-medium text-[var(--accent)]"
          >
            Ver agenda →
          </Link>
        </div>
        {!todayLessons?.length ? (
          <div className="panel p-6 text-center">
            <p className="font-medium">Nenhuma aula hoje</p>
            <p className="mt-1 text-sm text-[var(--ink-muted)]">
              Bom momento para organizar a semana.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {todayLessons.map((lesson) => {
              const pkg = lesson.lesson_packages as {
                title: string;
                students: { name: string } | null;
              } | null;
              return (
                <li key={lesson.id}>
                  <Link
                    href={`/aulas/${lesson.id}`}
                    className="panel flex items-center justify-between gap-3 p-3 transition hover:border-[var(--accent)]"
                  >
                    <div>
                      <p className="text-sm capitalize text-[var(--ink-muted)]">
                        {formatLessonDate(lesson.scheduled_at)}
                      </p>
                      <p className="font-semibold">
                        {pkg?.students?.name ?? "Aluno"}
                      </p>
                      <p className="text-sm text-[var(--ink-muted)]">
                        {pkg?.title}
                      </p>
                    </div>
                    <span className={`badge badge-${lesson.status}`}>
                      {statusLabel(lesson.status)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Pagamentos atrasados</h2>
          <Link
            href="/faturamento"
            className="text-sm font-medium text-[var(--accent)]"
          >
            Ver todos →
          </Link>
        </div>
        {!overduePayments.length ? (
          <div className="panel p-5 text-sm text-[var(--ink-muted)]">
            Nenhum pagamento atrasado no momento.
          </div>
        ) : (
          <ul className="space-y-2">
            {overduePayments.slice(0, 5).map((pkg) => (
              <li key={pkg.id}>
                <Link
                  href={`/pacotes/${pkg.id}`}
                  className="panel block p-3 transition hover:border-[var(--accent)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{pkg.title}</p>
                      <p className="text-sm text-[var(--ink-muted)]">
                        {pkg.studentName}
                      </p>
                    </div>
                    <span className="badge badge-missed">
                      {paymentStatusLabel(pkg.paymentStatus)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-[var(--danger)]">
                    Previsto {pkg.dueLabel} · falta {formatMoney(pkg.dueAmount)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Pacotes acabando</h2>
          <Link
            href="/pacotes"
            className="text-sm font-medium text-[var(--accent)]"
          >
            Ver pacotes →
          </Link>
        </div>
        {!endingPackages.length ? (
          <div className="panel p-5 text-sm text-[var(--ink-muted)]">
            Nenhum pacote perto do fim.
          </div>
        ) : (
          <ul className="space-y-2">
            {endingPackages.map((pkg) => (
              <li key={pkg.id}>
                <Link
                  href={`/pacotes/${pkg.id}`}
                  className="panel block p-3 transition hover:border-[var(--accent)]"
                >
                  <p className="font-semibold">{pkg.title}</p>
                  <p className="text-sm text-[var(--ink-muted)]">
                    {pkg.studentName}
                  </p>
                  <p className="mt-2 text-sm text-[var(--warning)]">
                    {pkg.completed}/{pkg.total} dadas · resta {pkg.remaining}{" "}
                    aula{pkg.remaining === 1 ? "" : "s"}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
