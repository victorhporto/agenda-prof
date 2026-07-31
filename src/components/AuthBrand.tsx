import Link from "next/link";

export function AuthBrand({
  tagline = "Agenda e pacotes para professores autônomos",
}: {
  tagline?: string;
}) {
  return (
    <Link href="/" className="auth-brand group block outline-none">
      <span className="font-display text-[2.75rem] leading-none font-bold tracking-tight text-[var(--ink)] sm:text-5xl">
        Agenda
        <span className="text-[var(--accent)] transition-colors group-hover:text-[var(--accent-hover)]">
          Prof
        </span>
      </span>
      <span className="mt-3 block max-w-[16rem] text-sm leading-relaxed text-[var(--ink-muted)]">
        {tagline}
      </span>
    </Link>
  );
}
