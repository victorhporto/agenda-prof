import { formatDateOnly, formatMoney, paymentStatusLabel } from "@/lib/utils";
import { formatInSaoPaulo } from "@/lib/timezone";

export type MessageTemplates = {
  msg_completed: string | null;
  msg_missed: string | null;
  msg_rescheduled: string | null;
  msg_renewal: string | null;
  msg_payment_reminder: string | null;
  msg_signature: string | null;
  msg_signature_enabled: boolean;
};

export const DEFAULT_MSG_COMPLETED =
  "Olá! A aula {n} de {total} de {aluno} foi realizada em {data}. Restam {restantes} aula(s).";

export const DEFAULT_MSG_MISSED =
  "Olá! A aula de {aluno} prevista para {data} não foi realizada. Em breve combinamos a reposição.";

export const DEFAULT_MSG_RESCHEDULED =
  "Olá! A aula de {aluno} prevista para {data_antiga} foi remarcada para {data_nova}.";

export const DEFAULT_MSG_RENEWAL =
  "Olá! Encerramos o pacote de {total} aulas de {aluno} ({pacote}) com a aula de {data}. Se quiser continuar, podemos renovar o próximo pacote. Me avise!";

export const DEFAULT_MSG_PAYMENT_REMINDER =
  "Olá! Passando para lembrar do pagamento do pacote {pacote} de {aluno}. Valor: {valor}. Já pago: {valor_pago}. Falta: {faltante}. Data prevista: {data_prevista}. Status: {status}.";

export type SignatureOptions = {
  enabled?: boolean | null;
  text?: string | null;
};

export function formatLessonDate(date: Date | string) {
  return formatInSaoPaulo(date, "dd/MM/yyyy 'às' HH:mm");
}

function applyTemplate(
  template: string,
  vars: Record<string, string | number>,
) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = vars[key];
    return value === undefined || value === null ? `{${key}}` : String(value);
  });
}

export function withSignature(message: string, signature?: SignatureOptions) {
  if (!signature?.enabled) return message;
  const text = signature.text?.trim();
  if (!text) return message;
  return `${message}\n\n${text}`;
}

export function completedLessonMessage(
  params: {
    studentName: string;
    sequenceNumber: number;
    totalLessons: number;
    scheduledAt: Date | string;
    remaining: number;
  },
  customTemplate?: string | null,
  signature?: SignatureOptions,
) {
  const template = customTemplate?.trim() || DEFAULT_MSG_COMPLETED;
  const message = applyTemplate(template, {
    aluno: params.studentName,
    n: params.sequenceNumber,
    total: params.totalLessons,
    data: formatLessonDate(params.scheduledAt),
    restantes: params.remaining,
  });
  return withSignature(message, signature);
}

export function missedLessonMessage(
  params: {
    studentName: string;
    scheduledAt: Date | string;
  },
  customTemplate?: string | null,
  signature?: SignatureOptions,
) {
  const template = customTemplate?.trim() || DEFAULT_MSG_MISSED;
  const message = applyTemplate(template, {
    aluno: params.studentName,
    data: formatLessonDate(params.scheduledAt),
  });
  return withSignature(message, signature);
}

export function rescheduledLessonMessage(
  params: {
    studentName: string;
    oldDate: Date | string;
    newDate: Date | string;
  },
  customTemplate?: string | null,
  signature?: SignatureOptions,
) {
  const template = customTemplate?.trim() || DEFAULT_MSG_RESCHEDULED;
  const message = applyTemplate(template, {
    aluno: params.studentName,
    data_antiga: formatLessonDate(params.oldDate),
    data_nova: formatLessonDate(params.newDate),
  });
  return withSignature(message, signature);
}

export function renewalLessonMessage(
  params: {
    studentName: string;
    totalLessons: number;
    packageTitle: string;
    scheduledAt: Date | string;
  },
  customTemplate?: string | null,
  signature?: SignatureOptions,
) {
  const template = customTemplate?.trim() || DEFAULT_MSG_RENEWAL;
  const message = applyTemplate(template, {
    aluno: params.studentName,
    total: params.totalLessons,
    pacote: params.packageTitle,
    data: formatLessonDate(params.scheduledAt),
  });
  return withSignature(message, signature);
}

export function paymentReminderMessage(
  params: {
    studentName: string;
    packageTitle: string;
    price: number | null;
    amountPaid: number;
    dueAmount: number;
    paymentDueDate: string | null;
    paymentStatus: string;
  },
  customTemplate?: string | null,
  signature?: SignatureOptions,
) {
  const template = customTemplate?.trim() || DEFAULT_MSG_PAYMENT_REMINDER;
  const message = applyTemplate(template, {
    aluno: params.studentName,
    pacote: params.packageTitle,
    valor: formatMoney(params.price),
    valor_pago: formatMoney(params.amountPaid),
    faltante: formatMoney(params.dueAmount),
    data_prevista: formatDateOnly(params.paymentDueDate) ?? "não definida",
    status: paymentStatusLabel(params.paymentStatus),
  });
  return withSignature(message, signature);
}
