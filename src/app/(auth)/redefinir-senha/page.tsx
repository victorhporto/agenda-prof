"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthBrand } from "@/components/AuthBrand";
import { createClient } from "@/lib/supabase/client";

export default function RedefinirSenhaPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let settled = false;
    const hash = window.location.hash;
    const waitingHash =
      hash.includes("type=recovery") || hash.includes("access_token");

    function finish(user: { id: string } | null) {
      if (settled) return;
      settled = true;
      setHasSession(Boolean(user));
      if (!user) {
        setError(
          "Este link expirou ou é inválido. Peça um novo em Entrar → Esqueci a senha.",
        );
      }
      setReady(true);
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        finish(session?.user ?? null);
      }
      if (event === "INITIAL_SESSION" && session?.user && !waitingHash) {
        finish(session.user);
      }
    });

    if (!waitingHash) {
      void supabase.auth.getUser().then(({ data }) => {
        if (data.user) finish(data.user);
      });
    }

    const timeout = window.setTimeout(() => {
      void supabase.auth.getUser().then(({ data }) => finish(data.user));
    }, waitingHash ? 2500 : 800);

    return () => {
      subscription.unsubscribe();
      window.clearTimeout(timeout);
    };
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirm = String(form.get("confirm") ?? "");

    if (password.length < 6) {
      setError("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    router.push("/inicio");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <div className="auth-enter">
        <AuthBrand tagline="Defina uma senha nova para entrar." />
      </div>

      <div className="auth-enter auth-enter-delay mt-10">
        <h1 className="text-lg font-semibold tracking-tight text-[var(--ink)]">
          Nova senha
        </h1>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          Depois de salvar, você entra na agenda automaticamente.
        </p>

        <form onSubmit={onSubmit} className="panel mt-6 space-y-4 p-5">
          <label className="block text-sm font-medium text-[var(--ink-muted)]">
            Nova senha
            <input
              name="password"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              className="input mt-1"
              disabled={!hasSession}
            />
          </label>
          <label className="block text-sm font-medium text-[var(--ink-muted)]">
            Confirmar senha
            <input
              name="confirm"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              className="input mt-1"
              disabled={!hasSession}
            />
          </label>
          {error && <p className="form-error">{error}</p>}
          <button
            type="submit"
            disabled={loading || !ready || !hasSession}
            className="btn-primary w-full"
          >
            {loading ? "Salvando..." : "Salvar senha"}
          </button>
        </form>
      </div>
    </main>
  );
}
