import Link from "next/link";
import { ArrowUpRight, Bell, CreditCard, Globe2, Mail, ShieldCheck, Wrench } from "lucide-react";
import type { ReactNode } from "react";
import { PaperPanel, ProductPage, ProductSection } from "@/components/product-page";
import { requireSignedInUser, requireStaffMfa } from "@/lib/auth";

const settingLinks = [
  { href: "/admin/settings/general", title: "General", description: "Product identity, canonical URL, support contact and global display defaults.", status: "Owner inputs pending", icon: Globe2 },
  { href: "/admin/settings/security", title: "Security", description: "Authentication methods, MFA, session controls, limits and staff access.", status: "Review required", icon: ShieldCheck },
  { href: "/admin/settings/email", title: "Email", description: "Auth templates, sender identity, transactional mail and delivery evidence.", status: "Provider pending", icon: Mail },
  { href: "/admin/settings/notifications", title: "Notifications", description: "In-app announcements, learner preferences and operational alerts.", status: "In-app ready", icon: Bell },
  { href: "/admin/settings/maintenance", title: "Maintenance", description: "A future banner and controlled read-only maintenance window.", status: "Not connected", icon: Wrench },
  { href: "/admin/settings/payments", title: "Payments", description: "bKash recipient, instructions and plan setup. Checkout remains disabled until approved.", status: "Disabled by default", icon: CreditCard },
  { href: "/admin/settings/integrations", title: "Integrations", description: "Google Sheets and storage configuration presence, without exposing secrets.", status: "Sheets deferred", icon: ArrowUpRight },
];

export async function AdminSettingsGuard({ nextPath, children }: { nextPath: string; children: ReactNode }) {
  const { supabase, user } = await requireSignedInUser(nextPath);
  if (!supabase || !user) {
    return <ProductPage eyebrow="Staff workspace" title="Admin settings" description="Connect Supabase and sign in with an administrator account to manage platform settings."><ProductSection title="Setup required"><PaperPanel><p>Admin settings are restricted to authenticated administrators.</p></PaperPanel></ProductSection></ProductPage>;
  }

  const { data: roles, error } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  if (error || !roles?.some((row) => row.role === "admin")) {
    return <ProductPage eyebrow="Staff workspace" title="Administrator access required" description="These platform settings are restricted to administrators."><ProductSection title="Access restricted"><PaperPanel><p>Return to the learner dashboard or ask the project owner to assign your staff role.</p></PaperPanel></ProductSection></ProductPage>;
  }
  await requireStaffMfa(supabase, nextPath);
  return children;
}

export function AdminSettingsOverview() {
  return (
    <ProductPage eyebrow="Staff workspace · admin only" title="Platform settings" description="Review connected settings and owner decisions. Secret values are never shown in this workspace." className="product-page--admin">
      <ProductSection title="Settings areas" className="product-section--tint">
        <div className="settings-list admin-settings-list">{settingLinks.map(({ href, title, description, status, icon: Icon }) => <PaperPanel className="settings-card" key={href}><Icon aria-hidden="true" /><div><h3>{title}</h3><p>{description}</p><span className="status-chip status-chip--muted">{status}</span></div><Link className="text-link" href={href}>Open settings <ArrowUpRight size={15} aria-hidden="true" /></Link></PaperPanel>)}</div>
      </ProductSection>
      <ProductSection title="Current release boundary">
        <PaperPanel className="statement-panel"><p>These pages show configuration status or a draft template. They do not send email, publish maintenance banners, change authentication policy, or write to Google Sheets. Activate an integration only after its owner-supplied values, permissions and acceptance checks are complete.</p></PaperPanel>
      </ProductSection>
    </ProductPage>
  );
}

export type AdminSettingsDefinition = {
  slug: string;
  title: string;
  description: string;
  status: string;
  values: [string, string][];
  note: string;
  preview?: ReactNode;
};

export function AdminSettingsStatusPage({ setting }: { setting: AdminSettingsDefinition }) {
  return (
    <AdminSettingsGuard nextPath={`/admin/settings/${setting.slug}`}>
      <ProductPage eyebrow="Staff workspace · admin only" title={setting.title} description={setting.description} className="product-page--admin">
        <ProductSection title="Current status" className="product-section--tint">
          <PaperPanel className="data-panel">
            <p><Link className="text-link" href="/admin/settings">← Back to platform settings</Link></p>
            <p className="integration-state"><span className="status-chip status-chip--muted">{setting.status}</span></p>
            <div className="integration-checks">{setting.values.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
            <p className="section-note">{setting.note}</p>
          </PaperPanel>
        </ProductSection>
        {setting.preview ? <ProductSection title="Template preview"><PaperPanel className="data-panel">{setting.preview}</PaperPanel></ProductSection> : null}
      </ProductPage>
    </AdminSettingsGuard>
  );
}

export { settingLinks };
