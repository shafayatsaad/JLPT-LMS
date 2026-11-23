"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { useLocale } from "@/components/i18n/locale-provider";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function StartExamButton({ examFormId, activeAttemptId }: { examFormId: string; activeAttemptId?: string | null }) {
  const router = useRouter();
  const { t } = useLocale();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function start() {
    if (activeAttemptId) {
      router.push(`/attempts/${activeAttemptId}`);
      return;
    }
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError(t("examDetails.supabaseError"));
      return;
    }
    setBusy(true);
    setError("");
    const { data, error: startError } = await supabase.rpc("start_exam_attempt", {
      p_exam_form_id: examFormId,
      p_idempotency_key: crypto.randomUUID(),
    });
    setBusy(false);
    if (startError || !data) {
      const message = startError?.message ?? "This exam could not be started.";
      setError(message.includes("Premium access") ? t("examDetails.premiumRequired") : t("examDetails.startError"));
      return;
    }
    router.push(`/attempts/${data}`);
  }

  return <div className="start-exam-action"><button className="btn btn--primary" type="button" disabled={busy} onClick={() => void start()}>{busy ? t("examDetails.preparing") : activeAttemptId ? t("examDetails.continue") : t("examDetails.start")}<ArrowUpRight size={15} aria-hidden="true" /></button>{error ? <p className="form-message form-message--error" role="alert">{error}</p> : null}</div>;
}
