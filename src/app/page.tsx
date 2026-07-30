import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/agenda");

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-16">
      <p className="font-display text-4xl font-bold tracking-tight text-[var(--ink)] sm:text-5xl">
        AgendaProf
      </p>
      <h1 className="mt-4 max-w-xl text-xl leading-relaxed text-[var(--ink-muted)] sm:text-2xl">
        Controle pacotes, aulas dadas e remarcações — com mensagens prontas para
        enviar ao aluno.
      </h1>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link href="/cadastro" className="btn-primary">
          Criar conta
        </Link>
        <Link href="/login" className="btn-secondary">
          Entrar
        </Link>
      </div>
    </main>
  );
}
