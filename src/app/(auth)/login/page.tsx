"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthBrand } from "@/components/AuthBrand";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    router.push("/inicio");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <div className="auth-enter">
        <AuthBrand />
      </div>

      <div className="auth-enter auth-enter-delay mt-10">
        <h1 className="text-lg font-semibold tracking-tight text-[var(--ink)]">
          Entrar
        </h1>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          Acesse sua agenda de aulas.
        </p>

        <form onSubmit={onSubmit} className="panel mt-6 space-y-4 p-5">
          <label className="block text-sm font-medium text-[var(--ink-muted)]">
            E-mail
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              className="input mt-1"
            />
          </label>
          <label className="block text-sm font-medium text-[var(--ink-muted)]">
            Senha
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              minLength={6}
              className="input mt-1"
            />
          </label>
          {error && <p className="form-error">{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-[var(--ink-muted)]">
          Não tem conta?{" "}
          <Link href="/cadastro" className="font-medium text-[var(--accent)]">
            Cadastre-se
          </Link>
        </p>
      </div>
    </main>
  );
}
