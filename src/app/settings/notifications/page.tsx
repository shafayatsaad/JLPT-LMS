import Link from "next/link";
import { LocalizedText } from "@/components/i18n/localized-text";
import { NotificationPreferencesForm, type NotificationPreferences } from "@/components/notification-preferences-form";
import { PaperPanel, ProductPage, ProductSection } from "@/components/product-page";
import { requireSignedInUser } from "@/lib/auth";

export const metadata = { title: "Notification preferences · JLPT practice" };
export const dynamic = "force-dynamic";

const defaults: NotificationPreferences = {
  in_app_exam_updates: true,
  in_app_service_announcements: true,
  email_learning_updates: false,
  email_product_news: false,
};

export default async function NotificationPreferencesPage() {
  const { supabase, user } = await requireSignedInUser("/settings/notifications");
  if (!supabase || !user) {
    return <ProductPage eyebrow="Notification preferences" eyebrowKey="notifications.preferencesEyebrow" title="Choose your updates" titleKey="notifications.preferencesTitle" description="Sign in to manage optional notice preferences." descriptionKey="notifications.preferencesDescription"><ProductSection title="Account access" titleKey="settings.title"><PaperPanel><Link className="btn btn--primary" href="/auth/login?next=%2Fsettings%2Fnotifications"><LocalizedText messageKey="settings.signIn" /></Link></PaperPanel></ProductSection></ProductPage>;
  }

  const { data, error } = await supabase.rpc("get_my_notification_preferences");
  const saved = data?.[0];
  const preferences = saved ? {
    in_app_exam_updates: saved.in_app_exam_updates,
    in_app_service_announcements: saved.in_app_service_announcements,
    email_learning_updates: saved.email_learning_updates,
    email_product_news: saved.email_product_news,
  } satisfies NotificationPreferences : defaults;

  return (
    <ProductPage eyebrow="Notification preferences" eyebrowKey="notifications.preferencesEyebrow" title="Choose your updates" titleKey="notifications.preferencesTitle" description="Control optional learning and service updates. Required account notices stay available in your inbox." descriptionKey="notifications.preferencesDescription" className="product-page--dashboard">
      <ProductSection title="Optional updates" titleKey="notifications.preferencesSection" className="product-section--tint">
        <PaperPanel className="data-panel">
          {error ? <p className="inline-notice"><LocalizedText messageKey="notifications.preferencesUnavailable" /></p> : <NotificationPreferencesForm initial={preferences} />}
        </PaperPanel>
      </ProductSection>
      <ProductSection title="Your inbox" titleKey="notifications.inboxSection" className="product-section--compact"><Link className="text-link" href="/notifications"><LocalizedText messageKey="notifications.openInbox" /></Link></ProductSection>
    </ProductPage>
  );
}
