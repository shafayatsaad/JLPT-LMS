import Link from "next/link";
import { ArrowUpRight, Bell, BellRing, CircleUserRound, LockKeyhole, ShieldCheck } from "lucide-react";
import { PaperPanel, ProductPage, ProductSection } from "@/components/product-page";
import { requireSignedInUser } from "@/lib/auth";
import { LocalizedText } from "@/components/i18n/localized-text";

export const metadata = { title: "Settings · JLPT practice" };

const settingsLinks = [
  { href: "/account", labelKey: "settings.profileTitle", detailKey: "settings.profileDetail", icon: CircleUserRound },
  { href: "/settings/security", labelKey: "settings.securityTitle", detailKey: "settings.securityDetail", icon: LockKeyhole },
  { href: "/settings/notifications", labelKey: "notifications.preferencesTitle", detailKey: "notifications.preferencesDescription", icon: BellRing },
  { href: "/notifications", labelKey: "notifications.inboxSection", detailKey: "settings.notificationsDetail", icon: Bell },
  { href: "/settings/privacy", labelKey: "settings.privacyTitle", detailKey: "settings.privacyDetail", icon: ShieldCheck },
] as const;

export default async function SettingsPage() {
  const { user } = await requireSignedInUser("/settings");
  if (!user) return <ProductPage eyebrow="Learner workspace" eyebrowKey="settings.eyebrow" title="Account settings" titleKey="settings.title" description="Connect Supabase and sign in to manage your account." descriptionKey="account.setupRequired"><ProductSection title="Account access" titleKey="settings.title"><PaperPanel><Link className="btn btn--primary" href="/auth/login?next=%2Fsettings"><LocalizedText messageKey="settings.signIn" /></Link></PaperPanel></ProductSection></ProductPage>;
  return (
    <ProductPage eyebrow="Learner workspace" eyebrowKey="settings.eyebrow" title="Account settings" titleKey="settings.title" description="Manage the learner profile and find the security, notification and privacy areas." descriptionKey="settings.description" className="product-page--dashboard">
      <ProductSection title="Settings" titleKey="settings.title" className="product-section--tint">
        <div className="settings-list">{settingsLinks.map(({ href, labelKey, detailKey, icon: Icon }) => <PaperPanel className="settings-card" key={href}><Icon aria-hidden="true" /><div><h3><LocalizedText messageKey={labelKey} /></h3><p><LocalizedText messageKey={detailKey} /></p></div><Link className="text-link" href={href}><LocalizedText messageKey={labelKey} /> · <LocalizedText messageKey="common.open" /> <ArrowUpRight size={15} aria-hidden="true" /></Link></PaperPanel>)}</div>
      </ProductSection>
    </ProductPage>
  );
}
