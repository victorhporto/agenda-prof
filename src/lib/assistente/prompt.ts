import {
  LOCATION_LABELS,
  WEEKDAY_LABELS,
  type AssistenteFormInput,
  type CandidateSlot,
  type OccupiedBlock,
} from "@/lib/assistente/occupancy";

export type ChatTurn = {
  role: "user" | "assistant";
  content: string;
};

export function buildSystemPrompt(input: {
  form: AssistenteFormInput;
  occupied: OccupiedBlock[];
  candidates: CandidateSlot[];
  weekLabel: string;
}): string {
  const { form, occupied, candidates, weekLabel } = input;

  const occupiedLines =
    occupied.length === 0
      ? "- (nenhuma aula agendada nesta semana)"
      : occupied
          .map((block) => {
            const loc = block.location
              ? LOCATION_LABELS[block.location]
              : "local não cadastrado";
            const travel =
              block.location === "casa_aluno"
                ? `; ocupa ${block.occupiesStart}–${block.occupiesEnd} com locomoção`
                : "";
            return `- ${WEEKDAY_LABELS[block.weekday]} ${block.start}–${block.end} (${loc}${travel}): ${block.studentName} (${block.packageTitle})`;
          })
          .join("\n");

  const studentLines = form.studentSlots
    .map((slot) => `- ${WEEKDAY_LABELS[slot.weekday]} às ${slot.time}`)
    .join("\n");

  const teacherLines = form.teacherWindows
    .map(
      (window) =>
        `- ${WEEKDAY_LABELS[window.weekday]} ${window.start}–${window.end}`,
    )
    .join("\n");

  const candidateLines =
    candidates.length === 0
      ? "- (nenhum encaixe direto: os horários do aluno colidem com a grade ou ficam fora da disponibilidade do professor)"
      : candidates
          .map((slot) => {
            const extra =
              form.location === "casa_aluno"
                ? ` (ocupa ${slot.occupiesStart}–${slot.occupiesEnd} com locomoção)`
                : "";
            return `- ${WEEKDAY_LABELS[slot.weekday]} às ${slot.time}${extra}`;
          })
          .join("\n");

  return `Você é o assistente de grade do AgendaProf, um app para professores particulares.
Responda sempre em português, de forma clara e objetiva.

CONTEXTO DESTA CONVERSA
- Aluno: ${form.studentName}
- Aulas desejadas por semana: ${form.lessonsPerWeek}
- Local da aula: ${LOCATION_LABELS[form.location]}
- Semana usada como recorte da agenda: ${weekLabel}

Horários disponíveis do aluno (início de aula de 1h):
${studentLines}

Disponibilidade do professor:
${teacherLines}

Grade já ocupada (aulas agendadas nesta semana; aulas na casa do aluno ocupam 1h de locomoção antes e depois; aulas sem local cadastrado entram só com 1h):
${occupiedLines}

Encaixes já calculados pelo sistema (não invente um horário livre que não esteja aqui, salvo se o professor pedir para considerar outra hipótese e você deixar explícito que é uma simulação):
${candidateLines}

REGRAS
- Cada aula dura 1 hora.
- Prefira encaixar o aluno sem mover ninguém.
- Se o local do aluno novo for "Na casa do aluno", considere 1 hora de locomoção antes e 1 hora depois da aula como ocupadas para ESTE aluno. O deslocamento pode começar 1h antes da janela do professor, mas não pode colidir com outra aula nem com a locomoção de aulas já marcadas na casa do aluno.
- Aulas já cadastradas na casa do aluno também ocupam 1h antes e 1h depois; respeite a faixa "ocupa … com locomoção" da grade.
- Se não houver vaga, proponha o menor conjunto de remarcações, nomeando aluno e horário atuais da grade ocupada.
- Não invente aulas ocupadas além das listadas.
- Não afirme que gravou, criou ou remarcou nada na agenda. Você só sugere; o professor aplica depois em "Nova aula".
- Se o professor pedir outro dia, outro local ou outro recorte, raciocine em cima destes dados.
- Quando listar opções, comece pela melhor e explique o porquê em 2–4 frases.`;
}

export function parseChatTurns(raw: unknown): ChatTurn[] {
  if (!Array.isArray(raw)) return [];

  const turns: ChatTurn[] = [];
  for (const item of raw.slice(-30)) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const role = row.role === "assistant" ? "assistant" : row.role === "user" ? "user" : null;
    const content = typeof row.content === "string" ? row.content.trim() : "";
    if (!role || !content) continue;
    turns.push({ role, content: content.slice(0, 4000) });
  }
  return turns;
}
