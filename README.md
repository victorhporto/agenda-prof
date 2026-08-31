# AgendaProf

Agenda para professores autônomos: pacotes de aulas, check-in pós-aula e remarcações com mensagens prontas para copiar.

**Produção:** https://agendaprof-flame.vercel.app

## Stack

- Next.js (App Router) + TypeScript + Tailwind
- Supabase (Auth + Postgres + RLS) — projeto `agenda_prof` (`fyvlijmpzmjlhlunklyu`, região `sa-east-1`)
- Deploy: Vercel

## Setup local

1. Copie `.env.example` para `.env.local` e preencha as chaves do Supabase.
2. Para o assistente de grade, adicione `OPENAI_API_KEY` (opcional: `OPENAI_MODEL`, padrão `gpt-4o-mini`).
3. Instale e rode:

```bash
npm install
npm run dev
```

4. Abra [http://localhost:3000](http://localhost:3000).

## Auth no Supabase (importante)

No dashboard do projeto Supabase → Authentication → URL Configuration:

- Site URL: `https://agendaprof-flame.vercel.app`
- Redirect URLs: `https://agendaprof-flame.vercel.app/**` e `http://localhost:3000/**`

Para redefinir senha (local): o redirect do e-mail deve ser `http://localhost:3000/auth/callback?next=/redefinir-senha`. No app: **Entrar → Esqueci a senha**.

Para testar sem e-mail: Authentication → Providers → Email → desative **Confirm email**.

## Fluxo principal

1. Cadastre um aluno
2. Crie um pacote (ex.: 4 aulas)
3. Agende as aulas
4. No dia: **OK — aula dada** ou **Não foi dada** / **Remarcar**
5. Copie a mensagem gerada para o WhatsApp

## Assistente de grade

Em **Assistente**, informe disponibilidade do aluno e a sua. O sistema lê as aulas `scheduled` da semana atual (Brasília) e a OpenAI sugere um encaixe. Nada é gravado na agenda — você aplica depois em **Nova aula**.

Ao agendar, o local vem do cadastro do aluno e pode ser alterado só nesta aula. Aulas na casa do aluno consideram 1h de locomoção antes e depois na sugestão do assistente. Se a aula não tiver local, vale o padrão do aluno; se nenhum dos dois existir, entra na grade só com 1h.

O horário do professor fica no **Perfil** (padrão: segunda a sexta, 10h–20h, até você salvar o seu). O Assistente usa esse horário automaticamente.

## Regra de saldo

Só aulas com status `completed` consomem o pacote. Falta e remarcação não consomem até a aula ser dada.

## Instalar no celular (PWA)

1. Abra o app no Chrome (Android) ou Safari (iPhone)
2. **Android:** menu → **Adicionar à tela inicial**
3. **iPhone:** compartilhar → **Adicionar à Tela de Início**

O atalho aparece como **AgendaProf** com o ícone de agenda/relógio.
