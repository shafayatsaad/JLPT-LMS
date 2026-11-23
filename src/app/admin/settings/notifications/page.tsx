import Link from "next/link";
import { AdminSettingsStatusPage } from "@/components/admin/admin-settings-template";

export const dynamic = "force-dynamic";
export const metadata = { title: "Notification settings · Administration" };

export default function AdminNotificationSettingsPage() {
  return <AdminSettingsStatusPage setting={{
    slug: "notifications",
    title: "Notification settings",
    description: "Review current in-app notice producers and deferred delivery channels.",
    status: "In-app notices available",
    values: [
      ["Admin announcements", "Bilingual draft and publish workflow"],
      ["Exam result notices", "In-app producer available"],
      ["Payment notices", "In-app only"],
      ["Learner preference controls", "Available under account settings"],
      ["Email delivery", "Disabled · provider setup pending"],
      ["Admin payment alert recipients", "Not configured"],
    ],
    note: "Essential account, security, payment and support notices remain visible to learners. Optional email choices do not send mail until a verified provider and producer are connected.",
    preview: <p>Publish bilingual learner service notices from <Link className="text-link" href="/admin/announcements">the announcements workflow</Link>.</p>,
  }} />;
}
