import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export function formatLessonDate(iso: string) {
  return format(parseISO(iso), "EEE, dd/MM · HH:mm", { locale: ptBR });
}

export function formatShortDate(iso: string) {
  return format(parseISO(iso), "dd/MM/yyyy HH:mm", { locale: ptBR });
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
