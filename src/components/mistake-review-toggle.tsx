"use client";

import { useState } from "react";
import { Check, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/components/i18n/locale-provider";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function MistakeReviewToggle({ questionId, initiallyReviewed }: { questionId: string; initiallyReviewed: boolean }) {
  const router = useRouter();
  const { t } = useLocale();
  const [reviewed, setReviewed] = useState(initiallyReviewed);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function toggle() {
    setBusy(true);
    setError(false);
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError(true);
      setBusy(false);
      return;
    }
    try {
      const { error: updateError } = await supabase.rpc("set_my_mistake_reviewed", {
        p_question_id: questionId,
        p_reviewed: !reviewed,
      });
      if (updateError) {
        setError(true);
        return;
      }
      setReviewed(!reviewed);
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mistake-review-control">
      <button className="btn btn--secondary" type="button" disabled={busy} aria-pressed={reviewed} onClick={() => void toggle()}>
        {reviewed ? <RotateCcw size={16} aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}
        {busy ? t("mistakes.saving") : reviewed ? t("mistakes.markOpen") : t("mistakes.markReviewed")}
      </button>
      {error ? <span role="alert" className="bookmark-feedback">{t("mistakes.saveError")}</span> : null}
    </div>
  );
}
