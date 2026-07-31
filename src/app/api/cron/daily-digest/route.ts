import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildDailyDigest } from "@/lib/notifications/digest";
import { sendDigestEmail } from "@/lib/notifications/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;

  const headerSecret = request.headers.get("x-cron-secret");
  return headerSecret === secret;
}

async function runDailyDigest() {
  const supabase = createAdminClient();

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, full_name, notify_email")
    .eq("notify_email", true);

  if (profilesError) {
    throw new Error(profilesError.message);
  }

  const results: {
    teacherId: string;
    status: "sent" | "skipped" | "error";
    reason?: string;
  }[] = [];

  for (const profile of profiles ?? []) {
    try {
      const digest = await buildDailyDigest(supabase, profile.id);

      if (!digest.hasContent) {
        results.push({
          teacherId: profile.id,
          status: "skipped",
          reason: "empty",
        });
        continue;
      }

      const { data: userData, error: userError } =
        await supabase.auth.admin.getUserById(profile.id);

      if (userError || !userData.user?.email) {
        results.push({
          teacherId: profile.id,
          status: "error",
          reason: userError?.message ?? "sem e-mail",
        });
        continue;
      }

      await sendDigestEmail({
        to: userData.user.email,
        digest,
      });

      results.push({ teacherId: profile.id, status: "sent" });
    } catch (err) {
      results.push({
        teacherId: profile.id,
        status: "error",
        reason: err instanceof Error ? err.message : "erro desconhecido",
      });
    }
  }

  const summary = {
    sent: results.filter((r) => r.status === "sent").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    errors: results.filter((r) => r.status === "error").length,
    results,
  };

  return summary;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const summary = await runDailyDigest();
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Falha no cron.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  return GET(request);
}
