import { AdminSettingsGuard, AdminSettingsOverview } from "@/components/admin/admin-settings-template";

export const dynamic = "force-dynamic";
export const metadata = { title: "Platform settings · Administration" };

export default function AdminSettingsPage() {
  return <AdminSettingsGuard nextPath="/admin/settings"><AdminSettingsOverview /></AdminSettingsGuard>;
}
