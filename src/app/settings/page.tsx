import Link from "next/link";
import { ArrowUpRight, Bell, CircleUserRound, LockKeyhole, ShieldCheck } from "lucide-react";
import { PaperPanel, ProductPage, ProductSection } from "@/components/product-page";
import { requireSignedInUser } from "@/lib/auth";

export const metadata = { title: "Settings · JLPT practice" };

const settingsLinks = [
  { href: "/account", label: "Profile and study preferences", detail: "Name, target JLPT level, and explanation language", icon: CircleUserRound },
  { href: "/settings/security", label: "Sign-in and security", detail: "Account identity, password recovery, and security status", icon: LockKeyhole },
  { href: "/notifications", label: "Notifications", detail: "Review account and support updates", icon: Bell },
  { href: "/settings/privacy", label: "Privacy requests", detail: "Ask about a data export or account deletion", icon: ShieldCheck },
];

export default async function SettingsPage() {
  const { user } = await requireSignedInUser("/settings");
  if (!user) return <ProductPage eyebrow="Learner workspace" title="Account settings" description="Connect Supabase and sign in to manage your account."><ProductSection title="Account access"><PaperPanel><Link className="btn btn--primary" href="/auth/login?next=%2Fsettings">Sign in</Link></PaperPanel></ProductSection></ProductPage>;
  return (
    <ProductPage eyebrow="Learner workspace" title="Account settings" description="Manage the learner profile and find the security, notification and privacy areas." className="product-page--dashboard">
      <ProductSection title="Settings" className="product-section--tint">
        <div className="settings-list">{settingsLinks.map(({ href, label, detail, icon: Icon }) => <PaperPanel className="settings-card" key={href}><Icon aria-hidden="true" /><div><h3>{label}</h3><p>{detail}</p></div><Link className="text-link" href={href} aria-label={`Open ${label}`}>Open <ArrowUpRight size={15} aria-hidden="true" /></Link></PaperPanel>)}</div>
      </ProductSection>
    </ProductPage>
  );
}
