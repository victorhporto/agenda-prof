"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthBrand } from "@/components/AuthBrand";
import { createClient } from "@/lib/supabase/client";
import { authMessage } from "@/lib/auth-messages";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [forgot, setForgot] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("erro") === "link") {
      setError("Este link expirou ou é inválido. Peça um novo em Esqueci a senha.");
    }
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);

    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "");
    const supabase = createClient();

    if (forgot) {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email,
        {
          redirectTo: `${window.location.origin}/auth/callback?next=/redefinir-senha`,
        },
      );
      setLoading(false);
      if (resetError) {
        setError(authMessage(resetError.message));
        return;
      }
      setInfo("Se o e-mail existir, você recebe o link para definir uma senha nova.");
      return;
    }

    const password = String(form.get("password") ?? "");
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (authError) {
      setError(authMessage(authError.message));
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
          {forgot
            ? "Informe o e-mail da conta para receber o link."
            : "Acesse sua agenda de aulas."}
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
          {!forgot ? (
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
          ) : null}
          {error && <p className="form-error">{error}</p>}
          {info && (
            <p className="rounded-xl border border-[var(--accent)]/30 bg-[var(--accent-soft)] px-3 py-3 text-sm text-[var(--accent)]">
              {info}
            </p>
          )}
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading
              ? forgot
                ? "Enviando..."
                : "Entrando..."
              : forgot
                ? "Enviar link"
                : "Entrar"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-[var(--ink-muted)]">
          <button
            type="button"
            className="font-medium text-[var(--accent)]"
            onClick={() => {
              setForgot((current) => !current);
              setError(null);
              setInfo(null);
            }}
          >
            {forgot ? "Voltar ao login" : "Esqueci a senha"}
          </button>
        </p>
      </div>
    </main>
  );
}
