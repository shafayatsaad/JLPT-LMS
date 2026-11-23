"use client";

import { useLocale } from "@/components/i18n/locale-provider";

export function LanguageSwitch({ compact = false }: { compact?: boolean }) {
  const { language, setLanguage, t, saveError } = useLocale();
  return <span className={`language-switch${compact ? " language-switch--compact" : ""}`}>
    <label>
      <span>{t("common.language")}</span>
      <select aria-label={t("common.language")} value={language} onChange={(event) => void setLanguage(event.target.value as "en" | "bn")}>
        <option value="en">{t("common.english")}</option>
        <option value="bn">{t("common.bangla")}</option>
      </select>
    </label>
    {saveError ? <span className="language-switch__notice" role="status">{saveError}</span> : null}
  </span>;
}
