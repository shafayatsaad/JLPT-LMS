import Link from "next/link";
import { NotificationInbox, type NotificationItem } from "@/components/notification-inbox";
import { PaperPanel, ProductPage, ProductSection } from "@/components/product-page";
import { requireSignedInUser } from "@/lib/auth";

export const metadata = { title: "Notifications · JLPT practice" };
export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const { supabase, user } = await requireSignedInUser("/notifications");
  if (!supabase || !user) {
    return <ProductPage eyebrow="Notifications" title="Your account updates" description="Sign in to see account, support, exam, and payment notifications."><ProductSection title="Sign in required"><PaperPanel><Link className="btn btn--primary" href="/auth/login?next=%2Fnotifications">Continue to sign in</Link></PaperPanel></ProductSection></ProductPage>;
  }

  const { data, error } = await supabase
    .from("notifications")
    .select("id,notification_type,title,body,href,read_at,created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <ProductPage eyebrow="Learner workspace" title="Notifications" description="Important account and product updates stay here even if an email message is missed." className="product-page--dashboard">
      <ProductSection title="Recent updates" className="product-section--tint">
        <PaperPanel className="data-panel">
          {error ? <p className="inline-notice">Notifications are unavailable until migration 005 is applied to Supabase.</p> : <NotificationInbox items={(data ?? []) as NotificationItem[]} />}
        </PaperPanel>
      </ProductSection>
      <ProductSection title="Need help?" className="product-section--compact"><Link className="text-link" href="/support">Open the support center</Link></ProductSection>
    </ProductPage>
  );
}
