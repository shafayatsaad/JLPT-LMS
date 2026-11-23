"use client";

import { useEffect } from "react";
import { applyReducedMotionPreference } from "@/lib/display-preferences";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

function readLocalPreference() {
  try {
    const value = window.localStorage.getItem("jlpt-reduced-motion");
    if (value === "true" || value === "false") applyReducedMotionPreference(value === "true");
  } catch {
    // The operating-system setting remains active through CSS when storage is unavailable.
  }
}

export function DisplayPreferenceSync() {
  useEffect(() => {
    readLocalPreference();
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    const client = supabase;

    async function loadForUser(userId: string) {
      const { data } = await client.from("profiles").select("reduced_motion").eq("user_id", userId).maybeSingle();
      if (typeof data?.reduced_motion === "boolean") applyReducedMotionPreference(data.reduced_motion);
    }

    void client.auth.getUser().then(({ data }) => {
      if (data.user) void loadForUser(data.user.id);
    });
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      if (session?.user) window.setTimeout(() => void loadForUser(session.user.id), 0);
    });
    return () => subscription.unsubscribe();
  }, []);

  return null;
}
