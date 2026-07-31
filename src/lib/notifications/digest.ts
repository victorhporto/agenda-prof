import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { getPackageProgress } from "@/lib/package-progress";
import {
  formatDateOnly,
  formatMoney,
  packageBalance,
  statusLabel,
} from "@/lib/utils";

const TIMEZONE = "America/Sao_Paulo";

export type DailyDigestLesson = {
  id: string;
  scheduledAt: string;
  timeLabel: string;
  status: string;
  statusLabel: string;
  studentName: string;
  packageTitle: string;
};

export type DailyDigestOverdue = {
  id: string;
  title: string;
  studentName: string;
  dueLabel: string | null;
  dueAmount: number;
};

export type DailyDigestEnding = {
  id: string;
  title: string;
  studentName: string;
  remaining: number;
  completed: number;
  total: number;
};

export type DailyDigest = {
  teacherId: string;
  teacherName: string | null;
  dayYmd: string;
  dayLabel: string;
  lessons: DailyDigestLesson[];
  overduePayments: DailyDigestOverdue[];
  endingPackages: DailyDigestEnding[];
  hasContent: boolean;
};

/** Início/fim do dia civil em America/Sao_Paulo (UTC−3 o ano todo). */
export function saoPauloDayBounds(now = new Date()) {
  const dayYmd = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  const start = new Date(`${dayYmd}T00:00:00-03:00`);
  const end = new Date(`${dayYmd}T23:59:59.999-03:00`);

  const dayLabel = format(start, "EEEE, dd 'de' MMMM", { locale: ptBR });

  return { start, end, dayYmd, dayLabel };
}

function isOverdueOnDay(
  paymentStatus: string,
  paymentDueDate: string | null | undefined,
  dayYmd: string,
) {
  if (paymentStatus === "paid" || !paymentDueDate) return false;
  return paymentDueDate.slice(0, 10) < dayYmd;
}

export async function buildDailyDigest(
  supabase: SupabaseClient<Database>,
  teacherId: string,
  now = new Date(),
): Promise<DailyDigest> {
  const { start, end, dayYmd, dayLabel } = saoPauloDayBounds(now);

  const [{ data: profile }, { data: todayLessons }, { data: packages }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("full_name")
        .eq("id", teacherId)
        .maybeSingle(),
      supabase
        .from("lessons")
        .select(
          `
          id,
          scheduled_at,
          status,
          lesson_packages (
            title,
            students ( name )
          )
        `,
        )
        .eq("teacher_id", teacherId)
        .gte("scheduled_at", start.toISOString())
        .lte("scheduled_at", end.toISOString())
        .order("scheduled_at", { ascending: true }),
      supabase
        .from("lesson_packages")
        .select(
          `
          id,
          title,
          price,
          amount_paid,
          payment_status,
          payment_due_date,
          total_lessons,
          status,
          students ( name ),
          lessons ( status )
        `,
        )
        .eq("teacher_id", teacherId)
        .order("created_at", { ascending: false }),
    ]);

  const lessons: DailyDigestLesson[] = (todayLessons ?? []).map((lesson) => {
    const pkg = lesson.lesson_packages as {
      title: string;
      students: { name: string } | null;
    } | null;
    return {
      id: lesson.id,
      scheduledAt: lesson.scheduled_at,
      timeLabel: format(parseISO(lesson.scheduled_at), "HH:mm", {
        locale: ptBR,
      }),
      status: lesson.status,
      statusLabel: statusLabel(lesson.status),
      studentName: pkg?.students?.name ?? "Aluno",
      packageTitle: pkg?.title ?? "Pacote",
    };
  });

  const overduePayments: DailyDigestOverdue[] = (packages ?? [])
    .filter((pkg) =>
      isOverdueOnDay(pkg.payment_status, pkg.payment_due_date, dayYmd),
    )
    .map((pkg) => {
      const balance = packageBalance(pkg);
      const student = pkg.students as { name: string } | null;
      return {
        id: pkg.id,
        title: pkg.title,
        studentName: student?.name ?? "Aluno",
        dueLabel: formatDateOnly(pkg.payment_due_date),
        dueAmount: balance.due,
      };
    })
    .sort((a, b) => {
      const da = a.dueLabel ? a.dueLabel.split("/").reverse().join("-") : "";
      const db = b.dueLabel ? b.dueLabel.split("/").reverse().join("-") : "";
      return da.localeCompare(db);
    });

  const endingPackages: DailyDigestEnding[] = (packages ?? [])
    .filter((pkg) => pkg.status === "active")
    .map((pkg) => {
      const progress = getPackageProgress(pkg, pkg.lessons ?? []);
      const student = pkg.students as { name: string } | null;
      return {
        id: pkg.id,
        title: pkg.title,
        studentName: student?.name ?? "Aluno",
        remaining: progress.remaining,
        completed: progress.completed,
        total: pkg.total_lessons,
      };
    })
    .filter((pkg) => pkg.remaining > 0 && pkg.remaining <= 1)
    .sort((a, b) => a.remaining - b.remaining);

  return {
    teacherId,
    teacherName: profile?.full_name ?? null,
    dayYmd,
    dayLabel,
    lessons,
    overduePayments,
    endingPackages,
    hasContent:
      lessons.length > 0 ||
      overduePayments.length > 0 ||
      endingPackages.length > 0,
  };
}

export function renderDigestEmailHtml(
  digest: DailyDigest,
  appUrl: string,
): string {
  const greeting = digest.teacherName
    ? `Olá, ${escapeHtml(digest.teacherName)}`
    : "Olá";

  const lessonRows = digest.lessons.length
    ? digest.lessons
        .map(
          (l) =>
            `<li><strong>${escapeHtml(l.timeLabel)}</strong> — ${escapeHtml(l.studentName)} (${escapeHtml(l.packageTitle)}) · ${escapeHtml(l.statusLabel)}</li>`,
        )
        .join("")
    : "<li>Nenhuma aula hoje.</li>";

  const overdueRows = digest.overduePayments.length
    ? digest.overduePayments
        .map(
          (p) =>
            `<li><strong>${escapeHtml(p.studentName)}</strong> — ${escapeHtml(p.title)}${p.dueLabel ? ` · previsto ${escapeHtml(p.dueLabel)}` : ""} · falta ${escapeHtml(formatMoney(p.dueAmount))}</li>`,
        )
        .join("")
    : "<li>Nenhum pagamento atrasado.</li>";

  const endingRows = digest.endingPackages.length
    ? digest.endingPackages
        .map(
          (p) =>
            `<li><strong>${escapeHtml(p.studentName)}</strong> — ${escapeHtml(p.title)} · resta ${p.remaining} aula${p.remaining === 1 ? "" : "s"}</li>`,
        )
        .join("")
    : "<li>Nenhum pacote acabando.</li>";

  return `<!DOCTYPE html>
<html lang="pt-BR">
<body style="font-family: system-ui, sans-serif; color: #14201b; line-height: 1.5; max-width: 560px; margin: 0 auto; padding: 24px;">
  <p style="margin: 0 0 4px; font-size: 12px; color: #5a6b63; text-transform: capitalize;">${escapeHtml(digest.dayLabel)}</p>
  <h1 style="margin: 0 0 16px; font-size: 22px;">Resumo do dia — AgendaProf</h1>
  <p>${greeting}, aqui está o que importa hoje:</p>

  <h2 style="font-size: 16px; margin: 24px 0 8px;">Aulas hoje (${digest.lessons.length})</h2>
  <ul style="padding-left: 18px; margin: 0;">${lessonRows}</ul>

  <h2 style="font-size: 16px; margin: 24px 0 8px;">Pagamentos atrasados (${digest.overduePayments.length})</h2>
  <ul style="padding-left: 18px; margin: 0;">${overdueRows}</ul>

  <h2 style="font-size: 16px; margin: 24px 0 8px;">Pacotes acabando (${digest.endingPackages.length})</h2>
  <ul style="padding-left: 18px; margin: 0;">${endingRows}</ul>

  <p style="margin: 28px 0 0;">
    <a href="${escapeHtml(appUrl)}/inicio" style="display: inline-block; background: #0f6b4c; color: #fff; text-decoration: none; padding: 10px 16px; border-radius: 8px; font-weight: 600;">Abrir AgendaProf</a>
  </p>
  <p style="margin: 16px 0 0; font-size: 12px; color: #5a6b63;">
    Você pode desativar este e-mail em Mensagens → Notificações.
  </p>
</body>
</html>`;
}

export function renderDigestEmailText(
  digest: DailyDigest,
  appUrl: string,
): string {
  const lines = [
    `Resumo do dia — AgendaProf`,
    digest.dayLabel,
    "",
    `Aulas hoje (${digest.lessons.length}):`,
    ...(digest.lessons.length
      ? digest.lessons.map(
          (l) =>
            `- ${l.timeLabel} — ${l.studentName} (${l.packageTitle}) · ${l.statusLabel}`,
        )
      : ["- Nenhuma aula hoje."]),
    "",
    `Pagamentos atrasados (${digest.overduePayments.length}):`,
    ...(digest.overduePayments.length
      ? digest.overduePayments.map(
          (p) =>
            `- ${p.studentName} — ${p.title}${p.dueLabel ? ` · previsto ${p.dueLabel}` : ""} · falta ${formatMoney(p.dueAmount)}`,
        )
      : ["- Nenhum pagamento atrasado."]),
    "",
    `Pacotes acabando (${digest.endingPackages.length}):`,
    ...(digest.endingPackages.length
      ? digest.endingPackages.map(
          (p) =>
            `- ${p.studentName} — ${p.title} · resta ${p.remaining} aula${p.remaining === 1 ? "" : "s"}`,
        )
      : ["- Nenhum pacote acabando."]),
    "",
    `Abrir: ${appUrl}/inicio`,
  ];
  return lines.join("\n");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
