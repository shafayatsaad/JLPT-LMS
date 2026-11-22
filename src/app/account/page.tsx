import Link from "next/link";
import { ProductPage, ProductSection, PaperPanel } from "@/components/product-page";
import { ProfileForm } from "@/components/profile-form";
import { requireSignedInUser } from "@/lib/auth";

export const metadata = { title: "Account and subscription · JLPT practice" };
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const { supabase, user } = await requireSignedInUser("/account");
  if (!supabase || !user) {
    return <ProductPage eyebrow="Account" title="Account settings" description="Connect Supabase before using learner account settings."><ProductSection title="Supabase setup required"><PaperPanel><p>Configure the local environment and apply the migrations before creating a profile.</p><Link className="btn btn--primary" href="/auth/login">Sign in</Link></PaperPanel></ProductSection></ProductPage>;
  }
  const [{ data: profile, error: profileError }, { data: entitlements, error: entitlementError }, { data: payments, error: paymentError }] = await Promise.all([
    supabase.from("profiles").select("display_name,target_level,explanation_language").eq("user_id", user.id).maybeSingle(),
    supabase.from("user_entitlements").select("status,starts_at,ends_at,plan_id").eq("user_id", user.id).order("ends_at", { ascending: false }).limit(5),
    supabase.from("payment_submissions").select("status,amount,currency,submitted_at").eq("user_id", user.id).order("submitted_at", { ascending: false }).limit(5),
  ]);

  return (
    <ProductPage eyebrow="Account and subscription" title="Your account" description="Update study preferences and review any saved access records." className="product-page--dashboard">
      <ProductSection title="Study preferences" className="product-section--tint">
        <PaperPanel className="auth-panel">
          {profileError ? <p className="inline-notice">The profile table is not available yet. Apply the latest Supabase migration.</p> : <ProfileForm userId={user.id} displayName={profile?.display_name ?? ""} targetLevel={profile?.target_level ?? ""} language={profile?.explanation_language ?? "en"} />}
          <div className="security-row"><span><strong>Email</strong><br />{user.email}</span><Link className="text-link" href="/auth/forgot-password">Reset password</Link></div>
        </PaperPanel>
      </ProductSection>
      <ProductSection title="Subscription and payment status">
        <div className="dashboard-grid dashboard-grid--two">
          <PaperPanel className="data-panel"><h3>Access</h3>{entitlementError ? <p className="inline-notice">Access records are unavailable until the migration is applied.</p> : entitlements?.length ? <ul className="record-list">{entitlements.map((item, index) => <li key={`${item.plan_id}-${index}`}><span>{item.status}</span><span>{new Date(item.ends_at).toLocaleDateString("en", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" })}</span></li>)}</ul> : <p>No active plan is recorded.</p>}</PaperPanel>
          <PaperPanel className="data-panel"><h3>Payment review</h3>{paymentError ? <p className="inline-notice">Payment records are unavailable until the migration is applied.</p> : payments?.length ? <ul className="record-list">{payments.map((item, index) => <li key={`${item.submitted_at}-${index}`}><span>{item.status}</span><span>{item.currency} {item.amount}</span></li>)}</ul> : <p>No payment records are recorded.</p>}<Link className="text-link" href="/pricing">See access information</Link></PaperPanel>
        </div>
      </ProductSection>
    </ProductPage>
  );
}
