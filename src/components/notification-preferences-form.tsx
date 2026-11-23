"use client";

import { useState } from "react";
import { BellRing, Mail, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/components/i18n/locale-provider";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export type NotificationPreferences = {
  in_app_exam_updates: boolean;
  in_app_service_announcements: boolean;
  email_learning_updates: boolean;
  email_product_news: boolean;
};

export function NotificationPreferencesForm({ initial }: { initial: NotificationPreferences }) {
  const router = useRouter();
  const { t } = useLocale();
  const [preferences, setPreferences] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [saved, setSaved] = useState(false);

  function update(key: keyof NotificationPreferences, value: boolean) {
    setPreferences((current) => ({ ...current, [key]: value }));
    setSaved(false);
    setError(false);
  }

  async function save() {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError(true);
      return;
    }
    setBusy(true);
    setError(false);
    setSaved(false);
    try {
      const { error: saveError } = await supabase.rpc("save_my_notification_preferences", {
        p_in_app_exam_updates: preferences.in_app_exam_updates,
        p_in_app_service_announcements: preferences.in_app_service_announcements,
        p_email_learning_updates: preferences.email_learning_updates,
        p_email_product_news: preferences.email_product_news,
      });
      if (saveError) {
        setError(true);
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="notification-preferences">
      <section className="notification-preferences__group" aria-labelledby="in-app-preferences-title">
        <div className="notification-preferences__group-heading"><BellRing aria-hidden="true" /><div><h2 id="in-app-preferences-title">{t("notifications.inAppTitle")}</h2><p>{t("notifications.inAppDescription")}</p></div></div>
        <label className="notification-preference-toggle"><span><strong>{t("notifications.examUpdates")}</strong><small>{t("notifications.examUpdatesDescription")}</small></span><input type="checkbox" checked={preferences.in_app_exam_updates} onChange={(event) => update("in_app_exam_updates", event.target.checked)} /></label>
        <label className="notification-preference-toggle"><span><strong>{t("notifications.serviceAnnouncements")}</strong><small>{t("notifications.serviceAnnouncementsDescription")}</small></span><input type="checkbox" checked={preferences.in_app_service_announcements} onChange={(event) => update("in_app_service_announcements", event.target.checked)} /></label>
      </section>

      <section className="notification-preferences__group" aria-labelledby="email-preferences-title">
        <div className="notification-preferences__group-heading"><Mail aria-hidden="true" /><div><h2 id="email-preferences-title">{t("notifications.emailTitle")}</h2><p>{t("notifications.emailDescription")}</p></div></div>
        <label className="notification-preference-toggle"><span><strong>{t("notifications.learningEmail")}</strong><small>{t("notifications.learningEmailDescription")}</small></span><input type="checkbox" checked={preferences.email_learning_updates} onChange={(event) => update("email_learning_updates", event.target.checked)} /></label>
        <label className="notification-preference-toggle"><span><strong>{t("notifications.productEmail")}</strong><small>{t("notifications.productEmailDescription")}</small></span><input type="checkbox" checked={preferences.email_product_news} onChange={(event) => update("email_product_news", event.target.checked)} /></label>
        <p className="notification-preferences__notice">{t("notifications.emailNotConfigured")}</p>
      </section>

      <div className="notification-preferences__required"><ShieldCheck aria-hidden="true" /><p>{t("notifications.requiredNotice")}</p></div>
      {error ? <p className="form-message form-message--error" role="alert">{t("notifications.preferenceError")}</p> : null}
      {saved ? <p className="form-message form-message--success" role="status">{t("notifications.preferenceSaved")}</p> : null}
      <button className="btn btn--primary" type="button" disabled={busy} onClick={() => void save()}>{busy ? t("common.saving") : t("notifications.savePreferences")}</button>
    </div>
  );
}
