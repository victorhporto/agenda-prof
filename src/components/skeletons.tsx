import type { CSSProperties } from "react";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function Skeleton({
  className,
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return <div aria-hidden className={cx("skeleton", className)} style={style} />;
}

export function SkeletonText({
  lines = 2,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={cx("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          className="h-3.5 rounded-md"
          style={{ width: index === lines - 1 && lines > 1 ? "68%" : "100%" }}
        />
      ))}
    </div>
  );
}

export function PageHeaderSkeleton({
  withAction = true,
  subtitleWidth = "55%",
}: {
  withAction?: boolean;
  subtitleWidth?: string;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-2">
        <Skeleton className="h-9 w-40 rounded-lg" />
        <Skeleton
          className="h-4 rounded-md"
          style={{ width: subtitleWidth }}
        />
      </div>
      {withAction ? <Skeleton className="h-11 w-32 rounded-xl" /> : null}
    </div>
  );
}

export function StatCardsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="panel space-y-3 p-4">
          <Skeleton className="h-3.5 w-24 rounded-md" />
          <Skeleton className="h-8 w-14 rounded-lg" />
          <Skeleton className="h-3 w-28 rounded-md" />
        </div>
      ))}
    </div>
  );
}

export function ListCardsSkeleton({
  count = 4,
  rows = 3,
}: {
  count?: number;
  rows?: number;
}) {
  return (
    <ul className="space-y-2">
      {Array.from({ length: count }).map((_, index) => (
        <li key={index} className="panel p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-5 w-40 max-w-[45%] rounded-md" />
              <SkeletonText lines={Math.max(rows - 1, 1)} />
            </div>
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function FormSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <div className="panel space-y-4 p-5">
      {Array.from({ length: fields }).map((_, index) => (
        <div key={index} className="space-y-2">
          <Skeleton className="h-3.5 w-24 rounded-md" />
          <Skeleton className="h-11 w-full rounded-xl" />
        </div>
      ))}
      <Skeleton className="h-11 w-full rounded-xl" />
    </div>
  );
}

export function SectionSkeleton({
  titleWidth = "36%",
  cards = 3,
}: {
  titleWidth?: string;
  cards?: number;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton
          className="h-6 rounded-md"
          style={{ width: titleWidth }}
        />
        <Skeleton className="h-4 w-20 rounded-md" />
      </div>
      <ListCardsSkeleton count={cards} rows={2} />
    </section>
  );
}

/** Dashboard / Início */
export function InicioSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Carregando início">
      <PageHeaderSkeleton />
      <StatCardsSkeleton />
      <SectionSkeleton titleWidth="40%" cards={3} />
      <SectionSkeleton titleWidth="48%" cards={2} />
      <SectionSkeleton titleWidth="42%" cards={2} />
    </div>
  );
}

/** Agenda */
export function AgendaSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Carregando agenda">
      <PageHeaderSkeleton />
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-10 w-10 rounded-xl" />
        <Skeleton className="h-5 w-40 rounded-md" />
        <Skeleton className="h-10 w-10 rounded-xl" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-9 w-14 rounded-lg" />
        <Skeleton className="h-9 w-20 rounded-lg" />
        <Skeleton className="h-9 w-14 rounded-lg" />
      </div>
      <div className="panel p-3">
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 35 }).map((_, index) => (
            <Skeleton key={index} className="min-h-[4.5rem] rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Lista genérica (alunos, pacotes) */
export function ListPageSkeleton({
  label = "Carregando",
}: {
  label?: string;
}) {
  return (
    <div className="space-y-6" role="status" aria-label={label}>
      <PageHeaderSkeleton />
      <ListCardsSkeleton count={5} rows={2} />
    </div>
  );
}

/** Faturamento */
export function FaturamentoSkeleton() {
  return (
    <div
      className="space-y-6"
      role="status"
      aria-label="Carregando faturamento"
    >
      <PageHeaderSkeleton withAction={false} subtitleWidth="48%" />
      <StatCardsSkeleton />
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-9 w-20 rounded-full" />
        <Skeleton className="h-9 w-28 rounded-full" />
        <Skeleton className="h-9 w-24 rounded-full" />
        <Skeleton className="h-9 w-20 rounded-full" />
      </div>
      <ListCardsSkeleton count={4} rows={3} />
    </div>
  );
}

/** Detalhe (aula / pacote) */
export function DetailSkeleton({
  label = "Carregando detalhes",
}: {
  label?: string;
}) {
  return (
    <div className="space-y-6" role="status" aria-label={label}>
      <Skeleton className="h-4 w-28 rounded-md" />
      <div className="panel space-y-4 p-5">
        <Skeleton className="h-7 w-48 rounded-lg" />
        <SkeletonText lines={3} />
        <div className="flex gap-2">
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      </div>
      <div className="panel space-y-3 p-5">
        <Skeleton className="h-5 w-32 rounded-md" />
        <Skeleton className="h-11 w-full rounded-xl" />
        <Skeleton className="h-11 w-full rounded-xl" />
      </div>
    </div>
  );
}

/** Formulário (nova aula / novo pacote / mensagens) */
export function FormPageSkeleton({
  label = "Carregando formulário",
  fields = 5,
}: {
  label?: string;
  fields?: number;
}) {
  return (
    <div className="space-y-6" role="status" aria-label={label}>
      <PageHeaderSkeleton withAction={false} subtitleWidth="60%" />
      <FormSkeleton fields={fields} />
    </div>
  );
}
