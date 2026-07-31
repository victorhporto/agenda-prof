import { Resend } from "resend";
import type { DailyDigest } from "@/lib/notifications/digest";
import {
  renderDigestEmailHtml,
  renderDigestEmailText,
} from "@/lib/notifications/digest";

export async function sendDigestEmail(params: {
  to: string;
  digest: DailyDigest;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "https://agendaprof-flame.vercel.app";

  if (!apiKey) {
    throw new Error("RESEND_API_KEY não configurada.");
  }
  if (!from) {
    throw new Error("EMAIL_FROM não configurado.");
  }

  const resend = new Resend(apiKey);
  const subjectParts = [
    params.digest.lessons.length
      ? `${params.digest.lessons.length} aula${params.digest.lessons.length === 1 ? "" : "s"}`
      : null,
    params.digest.overduePayments.length
      ? `${params.digest.overduePayments.length} atraso${params.digest.overduePayments.length === 1 ? "" : "s"}`
      : null,
    params.digest.endingPackages.length
      ? `${params.digest.endingPackages.length} pacote${params.digest.endingPackages.length === 1 ? "" : "s"} acabando`
      : null,
  ].filter(Boolean);

  const subject = subjectParts.length
    ? `AgendaProf — ${subjectParts.join(" · ")}`
    : "AgendaProf — Resumo do dia";

  const { data, error } = await resend.emails.send({
    from,
    to: params.to,
    subject,
    html: renderDigestEmailHtml(params.digest, appUrl),
    text: renderDigestEmailText(params.digest, appUrl),
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}
