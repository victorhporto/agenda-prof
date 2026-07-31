import { parseISO } from "date-fns";
import {
  formatDateOnlyBr,
  formatInSaoPaulo,
  todayYmdSaoPaulo,
} from "@/lib/timezone";

export function formatLessonDate(iso: string) {
  return formatInSaoPaulo(iso, "EEE, dd/MM · HH:mm");
}

export function formatShortDate(iso: string) {
  return formatInSaoPaulo(iso, "dd/MM/yyyy HH:mm");
}

export function statusLabel(status: string) {
  const map: Record<string, string> = {
    scheduled: "Agendada",
    completed: "Concluída",
    missed: "Não dada",
    cancelled: "Cancelada",
    rescheduled: "Remarcada",
  };
  return map[status] ?? status;
}

/** @deprecated Prefira toSaoPauloInputValue — mantido para compat. */
export function toLocalInputValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatMoney(value: number | null | undefined) {
  const amount = Number(value ?? 0);
  return amount.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function paymentStatusLabel(status: string) {
  const map: Record<string, string> = {
    pending: "Pendente",
    partial: "Parcial",
    paid: "Pago",
  };
  return map[status] ?? status;
}

export function packageBalance(pkg: {
  price: number | null;
  amount_paid: number;
  payment_status: string;
}) {
  const price = Number(pkg.price ?? 0);
  const paid =
    pkg.payment_status === "paid" && Number(pkg.amount_paid) === 0
      ? price
      : Number(pkg.amount_paid ?? 0);
  const due = Math.max(price - paid, 0);
  return { price, paid, due };
}

export function formatDateOnly(value: string | null | undefined) {
  return formatDateOnlyBr(value);
}

export function isPaymentOverdue(
  paymentStatus: string,
  paymentDueDate: string | null | undefined,
  today = todayYmdSaoPaulo(),
) {
  if (paymentStatus === "paid" || !paymentDueDate) return false;
  return paymentDueDate.slice(0, 10) < today;
}

/** Evita new Date('YYYY-MM-DD') virar dia anterior em UTC. */
export function parseDateOnlyLocal(value: string): Date {
  return parseISO(`${value.slice(0, 10)}T12:00:00`);
}
