import { createClient } from "@/lib/supabase/server";
import { EmailDigestSettings } from "@/components/EmailDigestSettings";
import { MessageTemplatesForm } from "@/components/MessageTemplatesForm";

export default async function MensagensPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "msg_completed, msg_missed, msg_rescheduled, msg_renewal, msg_payment_reminder, msg_signature, msg_signature_enabled, notify_email",
    )
    .eq("id", user!.id)
    .single();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Mensagens
        </h1>
        <p className="mt-1 text-[var(--ink-muted)]">
          Personalize os textos enviados no WhatsApp. Use as variáveis entre
          chaves — elas são preenchidas automaticamente.
        </p>
      </div>

      <EmailDigestSettings
        initialEnabled={profile?.notify_email ?? true}
        email={user?.email ?? null}
      />

      <MessageTemplatesForm
        initial={{
          msg_completed: profile?.msg_completed ?? null,
          msg_missed: profile?.msg_missed ?? null,
          msg_rescheduled: profile?.msg_rescheduled ?? null,
          msg_renewal: profile?.msg_renewal ?? null,
          msg_payment_reminder: profile?.msg_payment_reminder ?? null,
          msg_signature: profile?.msg_signature ?? null,
          msg_signature_enabled: profile?.msg_signature_enabled ?? false,
        }}
      />
    </div>
  );
}
