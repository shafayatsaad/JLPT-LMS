import Link from "next/link";
import { ArrowUpRight, LockKeyhole, WalletCards } from "lucide-react";
import { ProductPage, ProductSection, PaperPanel } from "@/components/product-page";
import { ProfileForm } from "@/components/profile-form";
import { requireSignedInUser } from "@/lib/auth";
import { LocalizedText } from "@/components/i18n/localized-text";

export const metadata = { title: "Profile · JLPT practice" };
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const { supabase, user } = await requireSignedInUser("/account");
  if (!supabase || !user) {
    return <ProductPage eyebrow="Account" title="Your profile" description="Connect Supabase before using learner profile settings." titleKey="settings.title" descriptionKey="account.setupRequired"><ProductSection title="Supabase setup required" titleKey="dashboard.setupRequired"><PaperPanel><p><LocalizedText messageKey="account.databaseSetup" /></p><Link className="btn btn--primary" href="/auth/login"><LocalizedText messageKey="settings.signIn" /></Link></PaperPanel></ProductSection></ProductPage>;
  }

  const { data: profile, error: profileError } = await supabase.from("profiles").select("display_name,target_level,explanation_language,ui_language,preferred_timezone,reduced_motion").eq("user_id", user.id).maybeSingle();

  return (
    <ProductPage eyebrow="Learner profile" eyebrowKey="settings.eyebrow" title="Your profile" titleKey="account.profilePageTitle" description="Update your study level, languages, time zone, and accessibility preferences." descriptionKey="account.profileDescription" className="product-page--dashboard">
      <ProductSection title="Study preferences" titleKey="settings.profileTitle" className="product-section--tint">
        <PaperPanel className="data-panel account-profile-panel">
          {profileError ? <p className="inline-notice" role="alert"><LocalizedText messageKey="account.profileUnavailable" /></p> : <ProfileForm userId={user.id} displayName={profile?.display_name ?? ""} targetLevel={profile?.target_level ?? ""} language={profile?.explanation_language ?? "en"} uiLanguage={profile?.ui_language === "bn" ? "bn" : "en"} preferredTimezone={profile?.preferred_timezone ?? "Asia/Dhaka"} reducedMotion={profile?.reduced_motion ?? false} />}
        </PaperPanel>
      </ProductSection>
      <ProductSection title="Account access" titleKey="settings.securityTitle" className="product-section--compact">
        <div className="account-destination-list">
            <PaperPanel className="account-destination"><LockKeyhole aria-hidden="true" /><div><h3><LocalizedText messageKey="settings.securityTitle" /></h3><p><span>{user.email ?? user.phone ?? "—"}</span><br /><small><LocalizedText messageKey={user.phone_confirmed_at ? "account.phoneVerified" : user.phone ? "account.phoneNotVerified" : "account.phoneNotProvided"} /></small></p></div><Link className="text-link" href="/settings/security"><LocalizedText messageKey="common.open" /> <ArrowUpRight size={15} aria-hidden="true" /></Link></PaperPanel>
          <PaperPanel className="account-destination"><WalletCards aria-hidden="true" /><div><h3><LocalizedText messageKey="account.plansAndPayments" /></h3><p><LocalizedText messageKey="account.plansAndPaymentsDescription" /></p></div><Link className="text-link" href="/subscription"><LocalizedText messageKey="account.plansAndPayments" /> <ArrowUpRight size={15} aria-hidden="true" /></Link></PaperPanel>
        </div>
      </ProductSection>
    </ProductPage>
  );
}
