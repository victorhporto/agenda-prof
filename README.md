# AgendaProf

Agenda para professores autônomos: pacotes de aulas, check-in pós-aula e remarcações com mensagens prontas para copiar.

**Produção:** https://agendaprof-flame.vercel.app

## Stack

- Next.js (App Router) + TypeScript + Tailwind
- Supabase (Auth + Postgres + RLS) — projeto `agenda_prof` (`fyvlijmpzmjlhlunklyu`, região `sa-east-1`)
- Deploy: Vercel

## Setup local

1. Copie `.env.example` para `.env.local` e preencha as chaves do Supabase.
2. Instale e rode:

```bash
npm install
npm run dev
```

3. Abra [http://localhost:3000](http://localhost:3000).

## Auth no Supabase (importante)

No dashboard do projeto Supabase → Authentication → URL Configuration:

- Site URL: `https://agendaprof-flame.vercel.app`
- Redirect URLs: `https://agendaprof-flame.vercel.app/**` e `http://localhost:3000/**`

Para testar sem e-mail: Authentication → Providers → Email → desative **Confirm email**.

## Fluxo principal

1. Cadastre um aluno
2. Crie um pacote (ex.: 4 aulas)
3. Agende as aulas
4. No dia: **OK — aula dada** ou **Não foi dada** / **Remarcar**
5. Copie a mensagem gerada para o WhatsApp

## Regra de saldo

Só aulas com status `completed` consomem o pacote. Falta e remarcação não consomem até a aula ser dada.
