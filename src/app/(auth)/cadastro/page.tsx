"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthBrand } from "@/components/AuthBrand";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const fullName = String(form.get("full_name") ?? "").trim();
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");

    const supabase = createClient();
    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
      },
    });

    setLoading(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    if (!data.session) {
      setError(
        "Conta criada. Confirme o e-mail (se exigido no Supabase) e faça login.",
      );
      return;
    }

    router.push("/inicio");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <div className="auth-enter">
        <AuthBrand tagline="Comece a organizar pacotes, aulas e remarcações." />
      </div>

      <div className="auth-enter auth-enter-delay mt-10">
        <h1 className="text-lg font-semibold tracking-tight text-[var(--ink)]">
          Criar conta
        </h1>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          Leva menos de um minuto.
        </p>

        <form onSubmit={onSubmit} className="panel mt-6 space-y-4 p-5">
          <label className="block text-sm font-medium text-[var(--ink-muted)]">
            Nome
            <input name="full_name" required className="input mt-1" />
          </label>
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
              autoComplete="new-password"
              minLength={6}
              className="input mt-1"
            />
          </label>
          {error && (
            <p className="form-error">
              {error}
            </p>
          )}
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Criando..." : "Criar conta"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-[var(--ink-muted)]">
          Já tem conta?{" "}
          <Link href="/login" className="font-medium text-[var(--accent)]">
            Entrar
          </Link>
        </p>
      </div>
    </main>
  );
}
