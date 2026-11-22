"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    setBusy(true);
    await supabase.auth.signOut();
    router.replace("/");
    router.refresh();
  }

  return <button className="btn btn--secondary" onClick={signOut} disabled={busy}>{busy ? "Signing out…" : "Sign out"}</button>;
}
