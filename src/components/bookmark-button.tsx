"use client";

import { useState } from "react";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/components/i18n/locale-provider";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function BookmarkButton({
  questionId,
  initiallyBookmarked = false,
  refreshOnChange = false,
}: {
  questionId: string;
  initiallyBookmarked?: boolean;
  refreshOnChange?: boolean;
}) {
  const { t } = useLocale();
  const router = useRouter();
  const [bookmarked, setBookmarked] = useState(initiallyBookmarked);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [notice, setNotice] = useState(false);

  async function toggle() {
    setBusy(true);
    setError(false);
    setNotice(false);
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError(true);
      setBusy(false);
      return;
    }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError(true);
        return;
      }
      const result = bookmarked
        ? await supabase.from("user_bookmarks").delete().eq("user_id", user.id).eq("question_id", questionId)
        : await supabase.from("user_bookmarks").insert({ user_id: user.id, question_id: questionId });
      if (result.error && !(result.error.code === "23505" && !bookmarked)) {
        setError(true);
      } else {
        const next = !bookmarked;
        setBookmarked(next);
        setNotice(true);
        if (refreshOnChange) router.refresh();
      }
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  const Icon = bookmarked ? BookmarkCheck : Bookmark;
  return (
    <div className="bookmark-control">
      <button
        className="btn btn--secondary bookmark-button"
        type="button"
        aria-pressed={bookmarked}
        disabled={busy}
        onClick={() => void toggle()}
      >
        <Icon size={16} aria-hidden="true" />
        {busy ? t("bookmarks.saving") : bookmarked ? t("bookmarks.remove") : t("bookmarks.save")}
      </button>
      {error ? <span className="bookmark-feedback" role="alert">{t("bookmarks.error")}</span> : null}
      {notice ? <span className="bookmark-feedback" role="status">{t(bookmarked ? "bookmarks.saved" : "bookmarks.removed")}</span> : null}
    </div>
  );
}
