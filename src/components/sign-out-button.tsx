"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useLocale } from "@/components/i18n/locale-provider";

export function SignOutButton({ className = "btn btn--secondary", onSignedOut }: { className?: string; onSignedOut?: () => void }) {
  const router = useRouter();
  const { t } = useLocale();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError(t("nav.signOutError"));
      return;
    }
    setBusy(true);
    setError("");
    const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });
    if (signOutError) {
      setError(t("nav.signOutError"));
      setBusy(false);
      return;
    }
    onSignedOut?.();
    router.replace("/");
    router.refresh();
  }

  return <>
    <button className={className} type="button" onClick={() => void signOut()} disabled={busy}>{busy ? t("nav.signingOut") : t("nav.signOut")}</button>
    {error ? <span className="inline-notice" role="alert">{error}</span> : null}
  </>;
}
