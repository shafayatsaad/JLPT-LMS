import Link from "next/link";
import { ProductPage, ProductSection, PaperPanel } from "@/components/product-page";
import { ProfileForm } from "@/components/profile-form";
import { requireSignedInUser } from "@/lib/auth";
import { LocalizedText } from "@/components/i18n/localized-text";

export const metadata = { title: "Account and subscription · JLPT practice" };
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const { supabase, user } = await requireSignedInUser("/account");
  if (!supabase || !user) {
    return <ProductPage eyebrow="Account" title="Account settings" description="Connect Supabase before using learner account settings." titleKey="settings.title" descriptionKey="account.setupRequired"><ProductSection title="Supabase setup required" titleKey="dashboard.setupRequired"><PaperPanel><p><LocalizedText messageKey="account.databaseSetup" /></p><Link className="btn btn--primary" href="/auth/login"><LocalizedText messageKey="settings.signIn" /></Link></PaperPanel></ProductSection></ProductPage>;
  }
  const [{ data: profile, error: profileError }, { data: entitlements, error: entitlementError }, { data: payments, error: paymentError }] = await Promise.all([
    supabase.from("profiles").select("display_name,target_level,explanation_language,ui_language,preferred_timezone,reduced_motion").eq("user_id", user.id).maybeSingle(),
    supabase.from("user_entitlements").select("status,starts_at,ends_at,plan_id").eq("user_id", user.id).order("ends_at", { ascending: false }).limit(5),
    supabase.from("payment_submissions").select("status,amount,currency,submitted_at").eq("user_id", user.id).order("submitted_at", { ascending: false }).limit(5),
  ]);

  return (
    <ProductPage eyebrow="Account and subscription" eyebrowKey="account.eyebrow" title="Your account" titleKey="account.title" description="Update study preferences and review any saved access records." descriptionKey="account.description" className="product-page--dashboard">
      <ProductSection title="Study preferences" titleKey="settings.profileTitle" className="product-section--tint">
        <PaperPanel className="auth-panel">
          {profileError ? <p className="inline-notice"><LocalizedText messageKey="account.profileUnavailable" /></p> : <ProfileForm userId={user.id} displayName={profile?.display_name ?? ""} targetLevel={profile?.target_level ?? ""} language={profile?.explanation_language ?? "en"} uiLanguage={profile?.ui_language === "bn" ? "bn" : "en"} preferredTimezone={profile?.preferred_timezone ?? "Asia/Dhaka"} reducedMotion={profile?.reduced_motion ?? false} />}
          <div className="security-row"><span><strong><LocalizedText messageKey="account.signInIdentity" /></strong><br />{user.email ?? user.phone}</span><Link className="text-link" href="/auth/forgot-password"><LocalizedText messageKey="account.resetPassword" /></Link></div>
        </PaperPanel>
      </ProductSection>
      <ProductSection title="Subscription and payment status" titleKey="account.subscriptionStatus">
        <div className="dashboard-grid dashboard-grid--two">
          <PaperPanel className="data-panel"><h3><LocalizedText messageKey="account.access" /></h3>{entitlementError ? <p className="inline-notice"><LocalizedText messageKey="account.paymentUnavailable" /></p> : entitlements?.length ? <ul className="record-list">{entitlements.map((item, index) => <li key={`${item.plan_id}-${index}`}><span>{item.status}</span><span>{new Date(item.ends_at).toLocaleDateString(profile?.ui_language === "bn" ? "bn-BD" : "en", { year: "numeric", month: "short", day: "numeric", timeZone: profile?.preferred_timezone ?? "Asia/Dhaka" })}</span></li>)}</ul> : <p><LocalizedText messageKey="account.noActivePlan" /></p>}</PaperPanel>
          <PaperPanel className="data-panel"><h3><LocalizedText messageKey="account.paymentReview" /></h3>{paymentError ? <p className="inline-notice"><LocalizedText messageKey="account.paymentUnavailable" /></p> : payments?.length ? <ul className="record-list">{payments.map((item, index) => <li key={`${item.submitted_at}-${index}`}><span>{item.status}</span><span>{item.currency} {item.amount}</span></li>)}</ul> : <p><LocalizedText messageKey="account.noPayments" /></p>}<Link className="text-link" href="/pricing"><LocalizedText messageKey="account.accessInformation" /></Link></PaperPanel>
        </div>
      </ProductSection>
      <ProductSection title="Learner tools" titleKey="account.learnerTools" className="product-section--compact">
        <div className="admin-link-list">
          <Link href="/notifications"><LocalizedText messageKey="account.notifications" /></Link>
          <Link href="/settings/notifications"><LocalizedText messageKey="notifications.preferencesTitle" /></Link>
          <Link href="/support"><LocalizedText messageKey="account.support" /></Link>
          <Link href="/mistakes"><LocalizedText messageKey="account.mistakes" /></Link>
          <Link href="/exams"><LocalizedText messageKey="account.examLibrary" /></Link>
          <Link href="/progress"><LocalizedText messageKey="account.progress" /></Link>
          <Link href="/payments"><LocalizedText messageKey="account.paymentHistory" /></Link>
          <Link href="/settings"><LocalizedText messageKey="account.settings" /></Link>
        </div>
      </ProductSection>
    </ProductPage>
  );
}
