import Link from "next/link";
import { LocalizedText } from "@/components/i18n/localized-text";
import { NotificationInbox, type InAppNotificationPreferences, type NotificationItem } from "@/components/notification-inbox";
import { PaperPanel, ProductPage, ProductSection } from "@/components/product-page";
import { requireSignedInUser } from "@/lib/auth";

export const metadata = { title: "Notifications · JLPT practice" };
export const dynamic = "force-dynamic";

const defaultPreferences: InAppNotificationPreferences = {
  in_app_exam_updates: true,
  in_app_service_announcements: true,
};

export default async function NotificationsPage() {
  const { supabase, user } = await requireSignedInUser("/notifications");
  if (!supabase || !user) {
    return <ProductPage eyebrow="Notifications" eyebrowKey="notifications.inboxEyebrow" title="Your account updates" titleKey="notifications.inboxTitle" description="Sign in to see account, support, exam, and payment notifications." descriptionKey="notifications.inboxDescription"><ProductSection title="Sign in required" titleKey="notifications.signInRequired"><PaperPanel><Link className="btn btn--primary" href="/auth/login?next=%2Fnotifications"><LocalizedText messageKey="settings.signIn" /></Link></PaperPanel></ProductSection></ProductPage>;
  }

  const [notificationsResult, preferencesResult, profileResult] = await Promise.all([
    supabase.from("notifications").select("id,notification_type,title,body,title_bn,body_bn,href,read_at,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100),
    supabase.rpc("get_my_notification_preferences"),
    supabase.from("profiles").select("preferred_timezone").eq("user_id", user.id).maybeSingle(),
  ]);
  const savedPreferences = preferencesResult.data?.[0];
  const preferences = savedPreferences ? {
    in_app_exam_updates: savedPreferences.in_app_exam_updates,
    in_app_service_announcements: savedPreferences.in_app_service_announcements,
  } : defaultPreferences;

  return (
    <ProductPage eyebrow="Learner workspace" eyebrowKey="notifications.inboxEyebrow" title="Notifications" titleKey="notifications.inboxTitle" description="Important account and product updates stay here even if an email message is missed." descriptionKey="notifications.inboxDescription" className="product-page--dashboard">
      <ProductSection title="Recent updates" titleKey="notifications.recent" className="product-section--tint">
        <PaperPanel className="data-panel">
          {notificationsResult.error ? <p className="inline-notice"><LocalizedText messageKey="notifications.inboxUnavailable" /></p> : <NotificationInbox items={(notificationsResult.data ?? []) as NotificationItem[]} preferences={preferences} timeZone={profileResult.data?.preferred_timezone ?? "Asia/Dhaka"} />}
        </PaperPanel>
      </ProductSection>
      <ProductSection title="Need help?" titleKey="notifications.needHelp" className="product-section--compact"><Link className="text-link" href="/support"><LocalizedText messageKey="notifications.openSupport" /></Link></ProductSection>
    </ProductPage>
  );
}
