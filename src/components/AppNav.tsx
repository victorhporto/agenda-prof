"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const links = [
  { href: "/agenda", label: "Agenda", short: "Agenda" },
  { href: "/alunos", label: "Alunos", short: "Alunos" },
  { href: "/pacotes", label: "Pacotes", short: "Pacotes" },
  { href: "/faturamento", label: "Faturamento", short: "Fin" },
  { href: "/mensagens", label: "Mensagens", short: "Msgs" },
];

export function AppNav() {
  const pathname = usePathname();
  const router = useRouter();

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
            {links.map((link) => {
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
          <button
            type="button"
            onClick={logout}
            className="rounded-lg px-3 py-1.5 text-sm text-[var(--ink-muted)] hover:bg-[var(--surface)] lg:hidden"
          >
            Sair
          </button>
        </div>
      </header>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur-md lg:hidden">
        <div className="mx-auto grid max-w-3xl grid-cols-5 gap-0.5 px-1 py-2">
          {links.map((link) => {
            const active = pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-xl px-1 py-2.5 text-center text-xs font-medium sm:text-sm ${
                  active
                    ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                    : "text-[var(--ink-muted)]"
                }`}
              >
                {link.short}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
