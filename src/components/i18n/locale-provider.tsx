"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { messages, translate, type MessageKey, type UiLanguage } from "@/lib/i18n";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type LocaleContextValue = {
  language: UiLanguage;
  setLanguage: (next: UiLanguage) => Promise<void>;
  t: (key: MessageKey, values?: Record<string, string | number>) => string;
  saveError: string;
};

const LocaleContext = createContext<LocaleContextValue>({
  language: "en",
  setLanguage: async () => undefined,
  t: (key) => messages.en[key],
  saveError: "",
});

function isUiLanguage(value: unknown): value is UiLanguage {
  return value === "en" || value === "bn";
}

function rememberLanguage(value: UiLanguage) {
  try { window.localStorage.setItem("jlpt-ui-language", value); } catch { /* Cookie remains available for the OAuth return. */ }
  document.cookie = `jlpt_ui_language=${value}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<UiLanguage>("en");
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadPreference() {
      try {
        const localPreference = window.localStorage.getItem("jlpt-ui-language");
        if (!cancelled && isUiLanguage(localPreference)) {
          setLanguageState(localPreference);
          rememberLanguage(localPreference);
        }
      } catch {
        // Local storage may be unavailable; English remains the default.
      }
      const supabase = createSupabaseBrowserClient();
      if (!supabase) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data, error } = await supabase.from("profiles").select("ui_language").eq("user_id", user.id).maybeSingle();
      if (cancelled || error || !isUiLanguage(data?.ui_language)) return;
      setLanguageState(data.ui_language);
      rememberLanguage(data.ui_language);
    }
    void loadPreference();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback(async (next: UiLanguage) => {
    setLanguageState(next);
    setSaveError("");
    rememberLanguage(next);
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("profiles").update({ ui_language: next, updated_at: new Date().toISOString() }).eq("user_id", user.id);
    if (error) setSaveError("This device remembers the language choice. Apply the latest database migration to sync it to the account.");
  }, []);

  const value = useMemo<LocaleContextValue>(() => ({
    language,
    setLanguage,
    t: (key, values) => translate(language, key, values),
    saveError,
  }), [language, saveError, setLanguage]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  return useContext(LocaleContext);
}
