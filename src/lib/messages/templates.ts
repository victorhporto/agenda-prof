import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

function formatDate(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
}

export function completedLessonMessage(params: {
  studentName: string;
  sequenceNumber: number;
  totalLessons: number;
  scheduledAt: Date | string;
  remaining: number;
}) {
  const { studentName, sequenceNumber, totalLessons, scheduledAt, remaining } =
    params;
  return `Olá! A aula ${sequenceNumber} de ${totalLessons} de ${studentName} foi realizada em ${formatDate(scheduledAt)}. Restam ${remaining} aula(s).`;
}

export function rescheduledLessonMessage(params: {
  studentName: string;
  oldDate: Date | string;
  newDate: Date | string;
}) {
  const { studentName, oldDate, newDate } = params;
  return `Olá! A aula de ${studentName} prevista para ${formatDate(oldDate)} foi remarcada para ${formatDate(newDate)}.`;
}

export function missedLessonMessage(params: {
  studentName: string;
  scheduledAt: Date | string;
}) {
  const { studentName, scheduledAt } = params;
  return `Olá! A aula de ${studentName} prevista para ${formatDate(scheduledAt)} não foi realizada. Em breve combinamos a reposição.`;
}
