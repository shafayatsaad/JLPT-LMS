import { AdminSettingsStatusPage } from "@/components/admin/admin-settings-template";

export const dynamic = "force-dynamic";
export const metadata = { title: "Maintenance settings · Administration" };

export default function AdminMaintenanceSettingsPage() {
  return <AdminSettingsStatusPage setting={{
    slug: "maintenance",
    title: "Maintenance settings",
    description: "Preview a future service banner without changing the live site or database access rules.",
    status: "No maintenance mode is active",
    values: [
      ["Site-wide maintenance switch", "Not connected"],
      ["Banner start/end window", "Not configured"],
      ["Read-only access mode", "Not implemented"],
      ["Database authorization", "Remains enforced regardless of maintenance state"],
    ],
    note: "A live maintenance switch requires a reviewed exclusion policy, approved schedule and deployment/rollback behavior. No toggle on this page can block learners or bypass database authorization.",
    preview: <div className="maintenance-banner-preview"><span className="status-chip status-chip--muted">Draft preview only</span><p>Scheduled maintenance message will appear here after the owner approves the copy and the feature is connected.</p></div>,
  }} />;
}
