"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";

type IconName =
  | "calendar"
  | "users"
  | "package"
  | "finance"
  | "message"
  | "more"
  | "logout";

const desktopLinks = [
  { href: "/agenda", label: "Agenda" },
  { href: "/alunos", label: "Alunos" },
  { href: "/pacotes", label: "Pacotes" },
  { href: "/faturamento", label: "Faturamento" },
  { href: "/mensagens", label: "Mensagens" },
];

const mobileLinks: { href: string; label: string; icon: IconName }[] = [
  { href: "/agenda", label: "Agenda", icon: "calendar" },
  { href: "/alunos", label: "Alunos", icon: "users" },
  { href: "/pacotes", label: "Pacotes", icon: "package" },
];

function NavIcon({ name }: { name: IconName }) {
  const paths: Record<IconName, ReactNode> = {
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M16 3v4M8 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
      </>
    ),
    users: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
    package: (
      <>
        <path d="m21 8-9-5-9 5 9 5 9-5Z" />
        <path d="m3 8 9 5 9-5M3 12l9 5 9-5M3 16l9 5 9-5" />
      </>
    ),
    finance: (
      <>
        <path d="M3 3v18h18" />
        <path d="m7 16 4-5 3 3 5-7" />
      </>
    ),
    message: (
      <>
        <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" />
        <path d="M8 8h8M8 12h5" />
      </>
    ),
    more: (
      <>
        <circle cx="5" cy="12" r="1" />
        <circle cx="12" cy="12" r="1" />
        <circle cx="19" cy="12" r="1" />
      </>
    ),
    logout: (
      <>
        <path d="M10 17l5-5-5-5M15 12H3" />
        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      </>
    ),
  };

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      {paths[name]}
    </svg>
  );
}

export function AppNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive =
    pathname.startsWith("/faturamento") || pathname.startsWith("/mensagens");

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--bg)]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-4 py-3">
          <Link
            href="/agenda"
            className="font-display text-lg font-semibold tracking-tight text-[var(--ink)]"
          >
            AgendaProf
          </Link>
          <nav className="hidden items-center gap-1 lg:flex">
            {desktopLinks.map((link) => {
              const active = pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-lg px-2.5 py-1.5 text-sm font-medium transition ${
                    active
                      ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                      : "text-[var(--ink-muted)] hover:bg-[var(--surface)] hover:text-[var(--ink)]"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
            <button
              type="button"
              onClick={logout}
              className="ml-1 rounded-lg px-3 py-1.5 text-sm text-[var(--ink-muted)] hover:bg-[var(--surface)] hover:text-[var(--ink)]"
            >
              Sair
            </button>
          </nav>
          <span className="text-xs font-medium text-[var(--ink-muted)] lg:hidden">
            Minha agenda
          </span>
        </div>
      </header>

      {moreOpen && (
        <div className="fixed inset-0 z-30 lg:hidden">
          <button
            type="button"
            aria-label="Fechar menu"
            className="absolute inset-0 bg-black/30"
            onClick={() => setMoreOpen(false)}
          />
          <div className="absolute inset-x-3 bottom-24 mx-auto max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-2 shadow-xl">
            <p className="px-3 pb-2 pt-1 text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
              Mais opções
            </p>
            <Link
              href="/faturamento"
              className="flex items-center gap-3 rounded-xl px-3 py-3 font-medium text-[var(--ink)] hover:bg-[var(--bg)]"
            >
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                <NavIcon name="finance" />
              </span>
              <span>
                <span className="block">Faturamento</span>
                <span className="block text-xs font-normal text-[var(--ink-muted)]">
                  Pagamentos e valores
                </span>
              </span>
            </Link>
            <Link
              href="/mensagens"
              className="flex items-center gap-3 rounded-xl px-3 py-3 font-medium text-[var(--ink)] hover:bg-[var(--bg)]"
            >
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                <NavIcon name="message" />
              </span>
              <span>
                <span className="block">Mensagens</span>
                <span className="block text-xs font-normal text-[var(--ink-muted)]">
                  Textos e assinatura
                </span>
              </span>
            </Link>
            <button
              type="button"
              onClick={logout}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 font-medium text-[var(--danger)] hover:bg-[var(--danger-soft)]"
            >
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--danger-soft)]">
                <NavIcon name="logout" />
              </span>
              Sair da conta
            </button>
          </div>
        </div>
      )}

      <nav
        aria-label="Navegação principal"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[var(--surface)]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
      >
        <div className="mx-auto grid max-w-md grid-cols-4 px-2 py-1.5">
          {mobileLinks.map((link) => {
            const active = pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-2 text-xs font-medium ${
                  active
                    ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                    : "text-[var(--ink-muted)]"
                }`}
              >
                <NavIcon name={link.icon} />
                {link.label}
              </Link>
            );
          })}
          <button
            type="button"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen((open) => !open)}
            className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-2 text-xs font-medium ${
              moreOpen || moreActive
                ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                : "text-[var(--ink-muted)]"
            }`}
          >
            <NavIcon name="more" />
            Mais
          </button>
        </div>
      </nav>
    </>
  );
}
