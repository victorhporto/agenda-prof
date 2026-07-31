import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

export const APP_TIMEZONE = "America/Sao_Paulo";

/** Formata instante ISO no fuso de Brasília. */
export function formatInSaoPaulo(
  value: Date | string,
  pattern: string,
): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return format(toZonedTime(date, APP_TIMEZONE), pattern, { locale: ptBR });
}

/** YYYY-MM-DD do “hoje” em Brasília. */
export function todayYmdSaoPaulo(now = new Date()): string {
  return formatInSaoPaulo(now, "yyyy-MM-dd");
}

/** Início/fim do dia civil em America/Sao_Paulo. */
export function saoPauloDayBounds(now = new Date()) {
  const dayYmd = todayYmdSaoPaulo(now);
  const start = fromZonedTime(`${dayYmd}T00:00:00`, APP_TIMEZONE);
  const end = fromZonedTime(`${dayYmd}T23:59:59.999`, APP_TIMEZONE);
  const dayLabel = formatInSaoPaulo(start, "EEEE, dd 'de' MMMM");
  return { start, end, dayYmd, dayLabel };
}

/** Limites do dia/semana/mês ancorados em Brasília a partir de YYYY-MM-DD. */
export function parseYmdInSaoPaulo(ymd: string): Date {
  return fromZonedTime(`${ymd.slice(0, 10)}T12:00:00`, APP_TIMEZONE);
}

/** Valor para input datetime-local no fuso de Brasília. */
export function toSaoPauloInputValue(value?: Date | string | null): string {
  const date = value
    ? typeof value === "string"
      ? new Date(value)
      : value
    : new Date();
  if (Number.isNaN(date.getTime())) return "";
  return formatInSaoPaulo(date, "yyyy-MM-dd'T'HH:mm");
}

/** Converte valor de datetime-local (hora de Brasília) para ISO UTC. */
export function saoPauloInputToIso(localValue: string): string | null {
  const trimmed = localValue.trim();
  if (!trimmed) return null;
  const normalized = trimmed.length === 16 ? `${trimmed}:00` : trimmed;
  const date = fromZonedTime(normalized, APP_TIMEZONE);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

/** Interpreta YYYY-MM-DD (data pura) sem deslocar o dia. */
export function formatDateOnlyBr(value: string | null | undefined): string | null {
  if (!value) return null;
  const [year, month, day] = value.slice(0, 10).split("-");
  if (!year || !month || !day) return null;
  return `${day}/${month}/${year}`;
}
