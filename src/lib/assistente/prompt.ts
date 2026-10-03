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
  WeekTravel,
} from "@/lib/assistente/rearrange";
import { formatMinutesLabel } from "@/lib/assistente/free-hours";
import type { Coordinates } from "@/lib/geo/geocode";
import {
  formatKm,
  formatTravel,
  roadDistanceKm,
  type TravelEstimate,
} from "@/lib/geo/travel";

export type ChatTurn = {
  role: "user" | "assistant";
  content: string;
};

function travelNote(item: {
  travelBefore?: TravelEstimate;
  travelAfter?: TravelEstimate;
  occupiesStart: string;
  occupiesEnd: string;
}) {
  const parts: string[] = [];
  if (item.travelBefore?.minutes) {
    parts.push(`deslocamento antes ${formatTravel(item.travelBefore)}`);
  }
  if (item.travelAfter?.minutes) {
    parts.push(`volta para a base ${formatTravel(item.travelAfter)}`);
  }
  if (parts.length === 0) return "";
  return `; ocupa ${item.occupiesStart}–${item.occupiesEnd} com ${parts.join(" e ")}`;
}

function formatOccupiedLines(occupied: OccupiedBlock[], empty: string) {
  if (occupied.length === 0) return empty;
  return occupied
    .map((block) => {
      const loc = block.location
        ? LOCATION_LABELS[block.location]
        : "local não cadastrado";
      return `- ${WEEKDAY_LABELS[block.weekday]} ${block.start}–${block.end} (${loc}${travelNote(block)}): ${block.studentName} (${block.packageTitle})`;
    })
    .join("\n");
}

const TRAVEL_RULE = `- O deslocamento é estimado pela distância entre os endereços (base do professor e casa de cada aluno), em blocos de 15 min. Aulas online e na casa do professor contam como na base. Sem endereço cadastrado, vale a estimativa padrão de 1h.
- O deslocamento antes da primeira aula do dia pode começar antes da janela do professor; entre aulas, o intervalo precisa comportar o deslocamento.`;

function formatTeacherLines(windows: TeacherWindow[]) {
  return windows
    .map(
      (window) =>
        `- ${WEEKDAY_LABELS[window.weekday]} ${window.start}–${window.end}`,
    )
    .join("\n");
}

function formatSlot(slot: CandidateSlot) {
  const note = travelNote(slot).replace(/^; /, "");
  const extra =
    slot.extraTravelMinutes != null && slot.extraTravelMinutes > 0
      ? `; acrescenta ~${slot.extraTravelMinutes} min de deslocamento ao dia`
      : "";
  const detail = [note, extra.replace(/^; /, "")].filter(Boolean).join("; ");
  return `${WEEKDAY_LABELS[slot.weekday]} às ${slot.time}${detail ? ` (${detail})` : ""}`;
}

function formatWeekTravel(travel: WeekTravel) {
  return `~${formatMinutesLabel(travel.minutes)} (${formatKm(travel.km)})`;
}

/** Só nomes e distâncias: endereços nunca vão para o modelo. */
function proximityLines(
  moving: MovingStudent[],
  fixed: OccupiedBlock[],
  base: Coordinates | null,
) {
  const others = new Map<string, { name: string; coords: Coordinates }>();
  for (const item of [
    ...fixed.map((block) => ({
      key: block.place?.key,
      name: block.studentName,
      coords: block.place?.coords,
    })),
    ...moving.map((student) => ({
      key: student.place.key,
      name: student.studentName,
      coords: student.place.coords,
    })),
  ]) {
    if (item.key && item.key !== "base" && item.coords) {
      others.set(item.key, { name: item.name, coords: item.coords });
    }
  }

  const lines: string[] = [];
  for (const student of moving) {
    const coords = student.place.coords;
    if (!coords || student.place.key === "base") continue;
    const nearest = [...others.entries()]
      .filter(([key]) => key !== student.place.key)
      .map(([, other]) => ({
        name: other.name,
        km: roadDistanceKm(coords, other.coords),
      }))
      .sort((a, b) => a.km - b.km)
      .slice(0, 3)
      .map((other) => `${other.name} ${formatKm(other.km)}`);
    const fromBase = base
      ? `base do professor ${formatKm(roadDistanceKm(base, coords))}`
      : null;
    const parts = [fromBase, ...nearest].filter(Boolean).join(", ");
    if (parts) lines.push(`- ${student.studentName}: ${parts}`);
  }
  return lines;
}

export function buildSystemPrompt(input: {
  form: AssistenteFormInput;
  occupied: OccupiedBlock[];
  candidates: CandidateSlot[];
  weekLabel: string;
  hasBase?: boolean;
}): string {
  const { form, occupied, candidates, weekLabel, hasBase } = input;

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
      : candidates.map((slot) => `- ${formatSlot(slot)}`).join("\n");

  const newStudentTravel =
    form.location === "casa_aluno"
      ? "- O endereço deste aluno novo ainda não é conhecido: o deslocamento até ele usa a estimativa padrão de 1h. Se o professor informar o bairro, você pode comentar a proximidade, deixando claro que é aproximado."
      : "";
  const baseNote = hasBase
    ? ""
    : "- O professor ainda não cadastrou o ponto de partida no perfil; deslocamentos de/para a base usam 1h.";

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

Grade já ocupada (aulas agendadas nesta semana, na ordem do dia, com o deslocamento estimado):
${occupiedLines}

Encaixes já calculados pelo sistema (não invente um horário livre que não esteja aqui, salvo se o professor pedir para considerar outra hipótese e você deixar explícito que é uma simulação):
${candidateLines}

REGRAS
- Cada aula dura 1 hora.
- Prefira encaixar o aluno sem mover ninguém.
${TRAVEL_RULE}
${[newStudentTravel, baseNote].filter(Boolean).join("\n")}
- Entre encaixes equivalentes, prefira o que acrescenta menos deslocamento ao dia.
- Se não houver vaga, proponha o menor conjunto de remarcações, nomeando aluno e horário atuais da grade ocupada.
- Não invente aulas ocupadas além das listadas.
- Não afirme que gravou, criou ou remarcou nada na agenda. Você só sugere; o professor aplica depois em "Nova aula".
- Se o professor pedir outro dia, outro local ou outro recorte, raciocine em cima destes dados.
- Quando listar opções, comece pela melhor e explique o porquê em 2–4 frases.`;
}

/** Faixas largas geram muitos inícios; a IA recebe os melhores primeiro. */
const MAX_PROMPT_CANDIDATES = 16;

export function buildRearrangePrompt(input: {
  teacherWindows: TeacherWindow[];
  fixed: OccupiedBlock[];
  moving: MovingStudent[];
  plan: RearrangePlan;
  weekLabel: string;
  base?: Coordinates | null;
}): string {
  const { teacherWindows, fixed, moving, plan, weekLabel, base = null } = input;

  const studentSections = moving
    .map((student) => {
      const loc = student.location
        ? LOCATION_LABELS[student.location]
        : "local não cadastrado";
      const current = student.current
        .map((block) => `${WEEKDAY_LABELS[block.weekday]} às ${block.start}`)
        .join("; ");
      const availability = student.ranges
        .map(
          (range) =>
            `${WEEKDAY_LABELS[range.weekday]} das ${range.start} às ${range.end}`,
        )
        .join("; ");
      const shown = student.candidates.slice(0, MAX_PROMPT_CANDIDATES);
      const hidden = student.candidates.length - shown.length;
      const candidates =
        student.candidates.length === 0
          ? "nenhum (todos colidem com a grade fixa ou ficam fora do horário do professor)"
          : shown.map((slot) => formatSlot(slot)).join("; ") +
            (hidden > 0 ? `; e mais ${hidden} início(s) parecidos nas mesmas faixas` : "");
      return `### ${student.studentName}
- Local: ${loc}
- Aulas por semana: ${student.lessonsPerWeek}
- Horário atual: ${current}
- Faixas em que o aluno pode ter aula (a aula de 1 hora precisa caber inteira): ${availability}
- Encaixes válidos contra a grade fixa: ${candidates}`;
    })
    .join("\n\n");

  const proximity = proximityLines(moving, fixed, base);
  const proximitySection = proximity.length
    ? `\nDISTÂNCIAS ESTIMADAS POR RUAS (alunos mais próximos de cada aluno remanejado)\n${proximity.join("\n")}\n`
    : "";

  const planLines = plan.entries
    .map((entry) => {
      const slots =
        entry.slots.length === 0
          ? "sem horário"
          : entry.slots.map((slot) => formatSlot(slot)).join("; ");
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

Grade fixa (alunos que NÃO serão movidos, com o deslocamento estimado):
${formatOccupiedLines(fixed, "- (nenhuma outra aula nesta semana)")}

ALUNOS A REMANEJAR
${studentSections}
${proximitySection}
PLANO CALCULADO PELO SISTEMA (sem conflitos entre si nem com a grade fixa; prioriza colocar todas as aulas, depois manter aulas no horário atual, depois o menor deslocamento semanal):
${planLines}
Aulas colocadas: ${plan.placedLessons} de ${plan.totalLessons}.
Deslocamento semanal estimado: atual ${formatWeekTravel(plan.currentTravel)}; com o plano ${formatWeekTravel(plan.proposedTravel)}.

REGRAS
- Cada aula dura 1 hora. Cada aluno tem no máximo uma aula por dia.
${TRAVEL_RULE}
- Use apenas os "encaixes válidos" de cada aluno. Dois alunos remanejados não podem se sobrepor nem deixar de comportar o deslocamento entre eles.
- Quando fizer sentido, agrupe no mesmo dia e em horários seguidos alunos que moram perto um do outro, e comente a economia de deslocamento.
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
