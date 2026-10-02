import {
  LOCATION_LABELS,
  WEEKDAY_LABELS,
  type AssistenteFormInput,
  type CandidateSlot,
  type OccupiedBlock,
  type TeacherWindow,
} from "@/lib/assistente/occupancy";
import type {
  MovingStudent,
  RearrangePlan,
} from "@/lib/assistente/rearrange";

export type ChatTurn = {
  role: "user" | "assistant";
  content: string;
};

function formatOccupiedLines(occupied: OccupiedBlock[], empty: string) {
  if (occupied.length === 0) return empty;
  return occupied
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
}

function formatTeacherLines(windows: TeacherWindow[]) {
  return windows
    .map(
      (window) =>
        `- ${WEEKDAY_LABELS[window.weekday]} ${window.start}–${window.end}`,
    )
    .join("\n");
}

function formatSlot(slot: CandidateSlot, withTravel: boolean) {
  const extra = withTravel
    ? ` (ocupa ${slot.occupiesStart}–${slot.occupiesEnd} com locomoção)`
    : "";
  return `${WEEKDAY_LABELS[slot.weekday]} às ${slot.time}${extra}`;
}

export function buildSystemPrompt(input: {
  form: AssistenteFormInput;
  occupied: OccupiedBlock[];
  candidates: CandidateSlot[];
  weekLabel: string;
}): string {
  const { form, occupied, candidates, weekLabel } = input;

  const occupiedLines = formatOccupiedLines(
    occupied,
    "- (nenhuma aula agendada nesta semana)",
  );

  const studentLines = form.studentSlots
    .map((slot) => `- ${WEEKDAY_LABELS[slot.weekday]} às ${slot.time}`)
    .join("\n");

  const teacherLines = formatTeacherLines(form.teacherWindows);

  const candidateLines =
    candidates.length === 0
      ? "- (nenhum encaixe direto: os horários do aluno colidem com a grade ou ficam fora da disponibilidade do professor)"
      : candidates
          .map(
            (slot) => `- ${formatSlot(slot, form.location === "casa_aluno")}`,
          )
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

export function buildRearrangePrompt(input: {
  teacherWindows: TeacherWindow[];
  fixed: OccupiedBlock[];
  moving: MovingStudent[];
  plan: RearrangePlan;
  weekLabel: string;
}): string {
  const { teacherWindows, fixed, moving, plan, weekLabel } = input;

  const studentSections = moving
    .map((student) => {
      const withTravel = student.location === "casa_aluno";
      const loc = student.location
        ? LOCATION_LABELS[student.location]
        : "local não cadastrado";
      const current = student.current
        .map((block) => `${WEEKDAY_LABELS[block.weekday]} às ${block.start}`)
        .join("; ");
      const availability = student.studentSlots
        .map((slot) => `${WEEKDAY_LABELS[slot.weekday]} às ${slot.time}`)
        .join("; ");
      const candidates =
        student.candidates.length === 0
          ? "nenhum (todos colidem com a grade fixa ou ficam fora do horário do professor)"
          : student.candidates
              .map((slot) => formatSlot(slot, withTravel))
              .join("; ");
      return `### ${student.studentName}
- Local: ${loc}
- Aulas por semana: ${student.lessonsPerWeek}
- Horário atual: ${current}
- Horários que o aluno aceita: ${availability}
- Encaixes válidos contra a grade fixa: ${candidates}`;
    })
    .join("\n\n");

  const planLines = plan.entries
    .map((entry) => {
      const student = moving.find((item) => item.studentId === entry.studentId);
      const withTravel = student?.location === "casa_aluno";
      const slots =
        entry.slots.length === 0
          ? "sem horário"
          : entry.slots.map((slot) => formatSlot(slot, withTravel)).join("; ");
      const missing =
        entry.missing > 0 ? ` — faltam ${entry.missing} aula(s)` : "";
      return `- ${entry.studentName}: ${slots}${missing}`;
    })
    .join("\n");

  return `Você é o assistente de grade do AgendaProf, um app para professores particulares.
Responda sempre em português, de forma clara e objetiva.

TAREFA
O professor quer remanejar o horário fixo semanal de alguns alunos que já estão na agenda. Proponha a melhor nova grade para ESTES alunos, sem mexer nos demais.

Semana usada como recorte da agenda: ${weekLabel}

Disponibilidade do professor:
${formatTeacherLines(teacherWindows)}

Grade fixa (alunos que NÃO serão movidos; aulas na casa do aluno ocupam 1h de locomoção antes e depois):
${formatOccupiedLines(fixed, "- (nenhuma outra aula nesta semana)")}

ALUNOS A REMANEJAR
${studentSections}

PLANO CALCULADO PELO SISTEMA (sem conflitos entre si nem com a grade fixa; prioriza colocar todas as aulas e, empatando, manter aulas no horário atual):
${planLines}
Aulas colocadas: ${plan.placedLessons} de ${plan.totalLessons}.

REGRAS
- Cada aula dura 1 hora. Cada aluno tem no máximo uma aula por dia.
- Use apenas os "encaixes válidos" de cada aluno. Dois alunos remanejados não podem se sobrepor, considerando a locomoção de 1h antes e depois das aulas na casa do aluno.
- Parta do plano calculado. Só proponha outro se for igualmente válido e você explicar a vantagem (ex.: menos mudanças, dias mais concentrados, menos deslocamento).
- Para cada aluno, mostre "de <horário atual> para <novo horário>" ou "mantém <horário>".
- Se faltar aula para algum aluno, diga claramente e sugira o que o professor pode fazer (pedir outros horários ao aluno, ampliar o horário de atendimento ou, se ele pedir, considerar mover um aluno da grade fixa — deixando explícito que é uma simulação).
- Não invente aulas além das listadas.
- Não afirme que gravou ou remarcou nada. Você só sugere; o professor remarca manualmente.
- Comece pelo resumo da nova grade e depois explique o porquê em 2–4 frases.`;
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
