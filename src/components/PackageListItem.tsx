import Link from "next/link";
import { RepeatPackageButton } from "@/components/RepeatPackageButton";
import { formatDateOnly, formatMoney, paymentStatusLabel } from "@/lib/utils";

type PackageListItemProps = {
  pkg: {
    id: string;
    title: string;
    status: string;
    payment_status: string;
    total_lessons: number;
    price: number | null;
    created_at: string;
  };
  progress: { completed: number; remaining: number };
  studentName?: string;
  highlighted?: boolean;
  showRepeat?: boolean;
};

export function PackageListItem({
  pkg,
  progress,
  studentName,
  highlighted = false,
  showRepeat = false,
}: PackageListItemProps) {
  return (
    <div
      id={highlighted ? `pacote-${pkg.id}` : undefined}
      className={highlighted ? "scroll-mt-6" : undefined}
    >
      <Link
        href={`/pacotes/${pkg.id}`}
        className={`panel block p-4 transition hover:border-[var(--accent)] ${
          highlighted ? "ring-2 ring-[var(--accent)] ring-offset-2" : ""
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-lg font-semibold">{pkg.title}</p>
            <p className="text-sm text-[var(--ink-muted)]">
              {studentName ? `${studentName} · ` : ""}
              {formatDateOnly(pkg.created_at)}
              {pkg.price != null ? ` · ${formatMoney(pkg.price)}` : ""}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span
              className={`badge ${
                pkg.status === "active" ? "badge-completed" : "badge-cancelled"
              }`}
            >
              {pkg.status === "active" ? "Ativo" : "Encerrado"}
            </span>
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
          </div>
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
      {showRepeat && pkg.status === "closed" && (
        <div className="mt-2 flex justify-end">
          <RepeatPackageButton packageId={pkg.id} compact />
        </div>
      )}
    </div>
  );
}
