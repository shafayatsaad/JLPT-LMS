import { AdminSettingsStatusPage } from "@/components/admin/admin-settings-template";

export const dynamic = "force-dynamic";
export const metadata = { title: "Email settings · Administration" };

export default function AdminEmailSettingsPage() {
  return <AdminSettingsStatusPage setting={{
    slug: "email",
    title: "Email settings",
    description: "Track authentication email ownership and the unconnected transactional email workflow.",
    status: "Sender setup pending",
    values: [
      ["Confirmation and recovery templates", "Managed in Supabase Auth"],
      ["Verified sender identity", "Pending owner/provider setup"],
      ["Payment received/approved/rejected email", "Not connected · in-app notices only"],
      ["Expiry reminders", "Not connected"],
      ["Test delivery", "Unavailable"],
      ["Delivery logs", "Unavailable"],
    ],
    note: "No app email is sent from this page. Configure and test Supabase Auth templates in the provider dashboard. Outbound payment/product mail needs an approved sender, copy, privacy policy and delivery log before activation.",
  }} />;
}
