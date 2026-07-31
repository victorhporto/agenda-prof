import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { getPackageProgress } from "@/lib/package-progress";
import {
  formatDateOnly,
  formatMoney,
  packageBalance,
  statusLabel,
} from "@/lib/utils";
import {
  formatInSaoPaulo,
  saoPauloDayBounds,
} from "@/lib/timezone";

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

export { saoPauloDayBounds };

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
      timeLabel: formatInSaoPaulo(lesson.scheduled_at, "HH:mm"),
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
  const totalOverdue = digest.overduePayments.reduce(
    (total, payment) => total + payment.dueAmount,
    0,
  );

  const lessonRows = digest.lessons.length
    ? digest.lessons
        .map(
          (l) =>
            `<tr>
              <td style="padding: 14px 0; border-bottom: 1px solid #e5ece8;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td width="62" valign="top">
                      <span style="display: inline-block; background: #d9efe6; color: #0f6b4c; border-radius: 8px; padding: 5px 8px; font-size: 13px; font-weight: 700;">${escapeHtml(l.timeLabel)}</span>
                    </td>
                    <td style="padding-left: 10px;">
                      <div style="font-size: 15px; font-weight: 700; color: #14201b;">${escapeHtml(l.studentName)}</div>
                      <div style="margin-top: 2px; font-size: 13px; color: #5a6b63;">${escapeHtml(l.packageTitle)} · ${escapeHtml(l.statusLabel)}</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>`,
        )
        .join("")
    : `<tr><td style="padding: 14px 0; color: #5a6b63; font-size: 14px;">Nenhuma aula hoje. Aproveite para organizar a semana.</td></tr>`;

  const overdueRows = digest.overduePayments.length
    ? digest.overduePayments
        .map(
          (p) =>
            `<tr>
              <td style="padding: 14px 0; border-bottom: 1px solid #f3e1df;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td>
                      <div style="font-size: 15px; font-weight: 700; color: #14201b;">${escapeHtml(p.studentName)}</div>
                      <div style="margin-top: 2px; font-size: 13px; color: #5a6b63;">${escapeHtml(p.title)}${p.dueLabel ? ` · previsto ${escapeHtml(p.dueLabel)}` : ""}</div>
                    </td>
                    <td align="right" valign="top" style="white-space: nowrap; padding-left: 12px; color: #b42318; font-size: 14px; font-weight: 700;">${escapeHtml(formatMoney(p.dueAmount))}</td>
                  </tr>
                </table>
              </td>
            </tr>`,
        )
        .join("")
    : `<tr><td style="padding: 14px 0; color: #5a6b63; font-size: 14px;">Nenhum pagamento atrasado. Tudo em dia!</td></tr>`;

  const endingRows = digest.endingPackages.length
    ? digest.endingPackages
        .map(
          (p) =>
            `<tr>
              <td style="padding: 14px 0; border-bottom: 1px solid #eee5ce;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td>
                      <div style="font-size: 15px; font-weight: 700; color: #14201b;">${escapeHtml(p.studentName)}</div>
                      <div style="margin-top: 2px; font-size: 13px; color: #5a6b63;">${escapeHtml(p.title)} · ${p.completed}/${p.total} aulas dadas</div>
                    </td>
                    <td align="right" valign="top" style="white-space: nowrap; padding-left: 12px;">
                      <span style="display: inline-block; background: #fff6db; color: #9a6700; border-radius: 999px; padding: 5px 9px; font-size: 12px; font-weight: 700;">Resta ${p.remaining}</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>`,
        )
        .join("")
    : `<tr><td style="padding: 14px 0; color: #5a6b63; font-size: 14px;">Nenhum pacote perto do fim.</td></tr>`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Resumo do dia — AgendaProf</title>
</head>
<body style="margin: 0; padding: 0; background: #eef3f0; font-family: Arial, Helvetica, sans-serif; color: #14201b; line-height: 1.5;">
  <div style="display: none; max-height: 0; overflow: hidden; opacity: 0;">${digest.lessons.length} aulas hoje, ${digest.overduePayments.length} pagamentos atrasados e ${digest.endingPackages.length} pacotes acabando.</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #eef3f0;">
    <tr>
      <td align="center" style="padding: 28px 12px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 620px; background: #ffffff; border-radius: 18px; overflow: hidden; box-shadow: 0 4px 20px rgba(20,32,27,.08);">
          <tr>
            <td style="background: #0f6b4c; padding: 28px 30px; color: #ffffff;">
              <div style="font-family: Georgia, serif; font-size: 22px; font-weight: 700;">AgendaProf</div>
              <div style="margin-top: 22px; font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: #bde2d2;">Resumo do dia</div>
              <h1 style="margin: 4px 0 0; font-size: 26px; line-height: 1.25; text-transform: capitalize;">${escapeHtml(digest.dayLabel)}</h1>
              <p style="margin: 10px 0 0; color: #e2f2eb; font-size: 15px;">${greeting}, aqui está o que merece sua atenção hoje.</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 30px 8px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td width="33.33%" valign="top" style="padding-right: 5px;">
                    <div style="background: #edf7f2; border-radius: 12px; padding: 14px 10px; text-align: center;">
                      <div style="font-size: 24px; font-weight: 800; color: #0f6b4c;">${digest.lessons.length}</div>
                      <div style="font-size: 11px; color: #5a6b63;">Aulas hoje</div>
                    </div>
                  </td>
                  <td width="33.33%" valign="top" style="padding: 0 5px;">
                    <div style="background: #fdf0ef; border-radius: 12px; padding: 14px 10px; text-align: center;">
                      <div style="font-size: 24px; font-weight: 800; color: #b42318;">${digest.overduePayments.length}</div>
                      <div style="font-size: 11px; color: #5a6b63;">Em atraso</div>
                    </div>
                  </td>
                  <td width="33.33%" valign="top" style="padding-left: 5px;">
                    <div style="background: #fff8e7; border-radius: 12px; padding: 14px 10px; text-align: center;">
                      <div style="font-size: 24px; font-weight: 800; color: #9a6700;">${digest.endingPackages.length}</div>
                      <div style="font-size: 11px; color: #5a6b63;">Acabando</div>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 18px 30px 0;">
              <h2 style="margin: 0; font-size: 17px; color: #14201b;">📅 Agenda de hoje</h2>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">${lessonRows}</table>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 30px 0;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td><h2 style="margin: 0; font-size: 17px; color: #14201b;">💳 Pagamentos atrasados</h2></td>
                  ${digest.overduePayments.length ? `<td align="right" style="color: #b42318; font-size: 13px; font-weight: 700;">Total: ${escapeHtml(formatMoney(totalOverdue))}</td>` : ""}
                </tr>
              </table>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">${overdueRows}</table>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 30px 0;">
              <h2 style="margin: 0; font-size: 17px; color: #14201b;">📦 Pacotes acabando</h2>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">${endingRows}</table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding: 30px;">
              <a href="${escapeHtml(appUrl)}/inicio" style="display: inline-block; background: #0f6b4c; color: #ffffff; text-decoration: none; padding: 13px 22px; border-radius: 10px; font-size: 15px; font-weight: 700;">Abrir meu AgendaProf →</a>
              <p style="margin: 18px 0 0; font-size: 12px; color: #7a8982;">Este resumo é enviado diariamente às 8h, quando há algo relevante.</p>
            </td>
          </tr>
          <tr>
            <td align="center" style="background: #f7faf8; border-top: 1px solid #e5ece8; padding: 18px 30px; font-size: 11px; color: #7a8982;">
              Você pode desativar este e-mail em <strong>Mensagens → Notificações</strong>.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
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
