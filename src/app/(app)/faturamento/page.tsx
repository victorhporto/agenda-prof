import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MarkPaidButton } from "@/components/MarkPaidButton";
import { PaymentReminderButton } from "@/components/PaymentReminderButton";
import {
  formatDateOnly,
  formatMoney,
  isPaymentOverdue,
  packageBalance,
  paymentStatusLabel,
} from "@/lib/utils";

type SearchParams = Promise<{ status?: string }>;

export default async function FaturamentoPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const filter = params.status ?? "all";
  const supabase = await createClient();

  let query = supabase
    .from("lesson_packages")
    .select(
      `
      id,
      title,
      price,
      amount_paid,
      payment_status,
      payment_due_date,
      paid_at,
      created_at,
      students ( name )
    `,
    );

  if (filter === "pending" || filter === "partial" || filter === "paid") {
    query = query.eq("payment_status", filter);
  }

  const { data: rawPackages } = await query;

  let packages = [...(rawPackages ?? [])];

  if (filter === "overdue") {
    packages = packages.filter((pkg) =>
      isPaymentOverdue(pkg.payment_status, pkg.payment_due_date),
    );
  }

  packages.sort((a, b) => {
    const rank = (pkg: {
      payment_status: string;
      payment_due_date: string | null;
      created_at: string;
    }) => {
      if (pkg.payment_status === "paid") {
        return { group: 2, due: Number.POSITIVE_INFINITY };
      }
      if (!pkg.payment_due_date) {
        return { group: 1, due: Number.POSITIVE_INFINITY };
      }
      return {
        group: 0,
        due: new Date(`${pkg.payment_due_date.slice(0, 10)}T00:00:00`).getTime(),
      };
    };

    const ra = rank(a);
    const rb = rank(b);
    if (ra.group !== rb.group) return ra.group - rb.group;
    if (ra.due !== rb.due) return ra.due - rb.due;
    return (
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  });

  const allQuery = await supabase
    .from("lesson_packages")
    .select("price, amount_paid, payment_status, payment_due_date");

  const all = allQuery.data ?? [];
  const totals = all.reduce(
    (acc, pkg) => {
      const balance = packageBalance(pkg);
      acc.sold += balance.price;
      acc.received += balance.paid;
      acc.due += balance.due;
      if (pkg.payment_status === "pending") acc.pendingCount += 1;
      if (pkg.payment_status === "partial") acc.partialCount += 1;
      if (pkg.payment_status === "paid") acc.paidCount += 1;
      if (isPaymentOverdue(pkg.payment_status, pkg.payment_due_date)) {
        acc.overdueCount += 1;
      }
      return acc;
    },
    {
      sold: 0,
      received: 0,
      due: 0,
      pendingCount: 0,
      partialCount: 0,
      paidCount: 0,
      overdueCount: 0,
    },
  );

  const filters = [
    { key: "all", label: "Todos" },
    {
      key: "overdue",
      label: `Atrasados (${totals.overdueCount})`,
    },
    { key: "pending", label: `Pendentes (${totals.pendingCount})` },
    { key: "partial", label: `Parciais (${totals.partialCount})` },
    { key: "paid", label: `Pagos (${totals.paidCount})` },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Faturamento
        </h1>
        <p className="mt-1 text-[var(--ink-muted)]">
          Acompanhe valores, datas previstas e atrasos. Os mais atrasados
          aparecem primeiro.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="panel p-4">
          <p className="text-sm text-[var(--ink-muted)]">Vendido</p>
          <p className="mt-1 text-2xl font-semibold">{formatMoney(totals.sold)}</p>
        </div>
        <div className="panel p-4">
          <p className="text-sm text-[var(--ink-muted)]">Recebido</p>
          <p className="mt-1 text-2xl font-semibold text-[var(--accent)]">
            {formatMoney(totals.received)}
          </p>
        </div>
        <div className="panel p-4">
          <p className="text-sm text-[var(--ink-muted)]">A receber</p>
          <p className="mt-1 text-2xl font-semibold text-[var(--warning)]">
            {formatMoney(totals.due)}
          </p>
          {totals.overdueCount > 0 && (
            <p className="mt-1 text-xs font-medium text-[var(--danger)]">
              {totals.overdueCount} atrasado
              {totals.overdueCount === 1 ? "" : "s"}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {filters.map((item) => (
          <Link
            key={item.key}
            href={
              item.key === "all"
                ? "/faturamento"
                : `/faturamento?status=${item.key}`
            }
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              filter === item.key
                ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                : "bg-[var(--surface)] text-[var(--ink-muted)] border border-[var(--border)]"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </div>

      {!packages?.length ? (
        <div className="panel p-8 text-center">
          <p className="font-medium">Nenhum pacote neste filtro</p>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">
            Cadastre pacotes com valor para acompanhar o faturamento.
          </p>
          <Link href="/pacotes/novo" className="btn-primary mt-4 inline-flex">
            Novo pacote
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {packages.map((pkg) => {
            const student = pkg.students as { name: string } | null;
            const balance = packageBalance(pkg);
            const dueLabel = formatDateOnly(pkg.payment_due_date);
            const overdue = isPaymentOverdue(
              pkg.payment_status,
              pkg.payment_due_date,
            );
            return (
              <li key={pkg.id} className="panel p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <Link
                      href={`/pacotes/${pkg.id}`}
                      className="font-semibold text-[var(--ink)] hover:text-[var(--accent)]"
                    >
                      {pkg.title}
                    </Link>
                    <p className="text-sm text-[var(--ink-muted)]">
                      {student?.name}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                      <span
                        className={`badge ${
                          pkg.payment_status === "paid"
                            ? "badge-completed"
                            : pkg.payment_status === "partial"
                              ? "badge-missed"
                              : "badge-scheduled"
                        }`}
                      >
                        {paymentStatusLabel(pkg.payment_status)}
                      </span>
                      <span>{formatMoney(balance.price)}</span>
                      {balance.due > 0 && (
                        <span className="text-[var(--warning)]">
                          falta {formatMoney(balance.due)}
                        </span>
                      )}
                      {dueLabel && (
                        <span
                          className={
                            overdue
                              ? "font-medium text-[var(--danger)]"
                              : "text-[var(--ink-muted)]"
                          }
                        >
                          previsto {dueLabel}
                          {overdue ? " · atrasado" : ""}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-44">
                    {pkg.payment_status !== "paid" && (
                      <MarkPaidButton packageId={pkg.id} />
                    )}
                    <PaymentReminderButton packageId={pkg.id} />
                    <Link
                      href={`/pacotes/${pkg.id}`}
                      className="btn-secondary px-3 py-1.5 text-center text-sm"
                    >
                      Detalhes
                    </Link>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
