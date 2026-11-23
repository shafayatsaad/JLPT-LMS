import { AdminSettingsStatusPage } from "@/components/admin/admin-settings-template";

export const dynamic = "force-dynamic";
export const metadata = { title: "General settings · Administration" };

function configuredOrigin() {
  const value = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!value) return "Not configured";
  try { return new URL(value).origin; } catch { return "Invalid deployment value"; }
}

export default function AdminGeneralSettingsPage() {
  return <AdminSettingsStatusPage setting={{
    slug: "general",
    title: "General settings",
    description: "Review the deployment identity and global values used by public pages.",
    status: "Owner values pending",
    values: [
      ["Product name", "JLPT Practice Platform · provisional"],
      ["Public site URL", configuredOrigin()],
      ["Support email", "Pending owner input"],
      ["Admin display time", "UTC"],
      ["Learner display time", "Per-account time zone preference"],
      ["Maintenance banner", "No published banner setting"],
    ],
    note: "Product identity, final canonical domain, support contact and global maintenance copy remain owner decisions. This page is read-only and does not alter deployment environment variables.",
  }} />;
}
