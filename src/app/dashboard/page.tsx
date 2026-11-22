import Link from "next/link";
import { ArrowUpRight, BookOpen, Clock3, RotateCcw } from "lucide-react";
import { ProductPage, ProductSection, PaperPanel } from "@/components/product-page";
import { SignOutButton } from "@/components/sign-out-button";
import { requireSignedInUser } from "@/lib/auth";

export const metadata = { title: "Learner dashboard · JLPT practice" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { supabase, user } = await requireSignedInUser("/dashboard");
  if (!supabase || !user) {
    return <ProductPage eyebrow="Learner dashboard" title="Your practice space" description="Connect the Supabase project to sign in and load saved learner data."><ProductSection title="Supabase setup required"><PaperPanel><p>Copy the configured values from <code>.env.example</code> into <code>.env.local</code>, restart the app, and apply the database migrations.</p><Link className="btn btn--primary" href="/auth/login">Continue to sign in</Link></PaperPanel></ProductSection></ProductPage>;
  }

  const [{ data: profile, error: profileError }, { data: attempts, error: attemptsError }, { data: forms }, { data: showWelcome }] = await Promise.all([
    supabase.from("profiles").select("display_name,target_level").eq("user_id", user.id).maybeSingle(),
    supabase.from("exam_attempts").select("id,level,status,created_at,submitted_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5),
    supabase.from("exam_forms").select("id,level,form_code").eq("status", "published").order("created_at", { ascending: false }).limit(8),
    supabase.rpc("claim_welcome_message"),
  ]);
  const activeAttempt = attempts?.find((attempt) => attempt.status === "in_progress");

  return (
    <ProductPage eyebrow="Learner dashboard" title={`Welcome${profile?.display_name ? `, ${profile.display_name}` : " back"}`} description="Choose a level, see saved attempts, and return to questions you want to review." className="product-page--dashboard">
      {showWelcome ? <ProductSection title="A new practice space" className="product-section--tint"><PaperPanel className="welcome-card"><span className="paper-tab">Account ready</span><h2>Welcome{profile?.display_name ? `, ${profile.display_name}` : " to JLPT Practice"}.</h2><p>Your account is set up. Choose your target level and explore your practice options whenever you are ready.</p><Link className="btn btn--secondary" href="/account">Set up your profile and preferences</Link></PaperPanel></ProductSection> : null}
      {activeAttempt ? <ProductSection title="Continue your exam" className="product-section--tint"><PaperPanel className="welcome-card"><span className="paper-tab">Attempt in progress</span><h2>JLPT {activeAttempt.level}</h2><p>Your answers are saved to this account. Resume the current section when you are ready.</p><Link className="btn btn--primary" href={`/attempts/${activeAttempt.id}`}>Continue exam <ArrowUpRight size={15} aria-hidden="true" /></Link></PaperPanel></ProductSection> : null}
      <ProductSection title="Your next step" className="product-section--tint">
        <div className="dashboard-grid">
          <PaperPanel className="action-panel"><span className="panel-icon"><BookOpen aria-hidden="true" /></span><h3>Explore a JLPT level</h3><p>{profile?.target_level ? `Your target is ${profile.target_level}.` : "Choose a level to see timed sections and practice options."}</p><Link className="text-link" href={profile?.target_level ? `/levels/${profile.target_level}` : "/#levels"}>View level details <ArrowUpRight size={15} aria-hidden="true" /></Link></PaperPanel>
          <PaperPanel className="action-panel"><span className="panel-icon"><RotateCcw aria-hidden="true" /></span><h3>Review mistakes</h3><p>See question statistics from saved attempts when available.</p><Link className="text-link" href="/mistakes">Open mistake notebook <ArrowUpRight size={15} aria-hidden="true" /></Link></PaperPanel>
          <PaperPanel className="action-panel"><span className="panel-icon"><Clock3 aria-hidden="true" /></span><h3>Try the interface preview</h3><p>The current N5 sample uses a local timer and is not a saved or scored attempt.</p><Link className="text-link" href="/exams/n5/preview">Open N5 preview <ArrowUpRight size={15} aria-hidden="true" /></Link></PaperPanel>
          <PaperPanel className="action-panel"><span className="panel-icon"><BookOpen aria-hidden="true" /></span><h3>Browse published exams</h3><p>See the reviewed forms available to your account when the library is populated.</p><Link className="text-link" href="/exams">Open exam library <ArrowUpRight size={15} aria-hidden="true" /></Link></PaperPanel>
        </div>
      </ProductSection>
      <ProductSection title="Recent attempts">
        <PaperPanel className="data-panel">
          {attemptsError ? <p className="inline-notice">Saved attempts are unavailable until the latest Supabase migration is applied.</p> : attempts?.length ? (
            <div className="table-scroll"><table><thead><tr><th>Level</th><th>Status</th><th>Started</th><th></th></tr></thead><tbody>{attempts.map((attempt) => <tr key={attempt.id}><td>{["submitted", "expired"].includes(attempt.status) ? <Link className="text-link" href={`/results/${attempt.id}`}>{attempt.level} result</Link> : attempt.level}</td><td><span className="status-chip">{attempt.status.replaceAll("_", " ")}</span></td><td>{new Date(attempt.created_at).toLocaleDateString("en", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" })}</td><td>{attempt.status === "in_progress" ? <Link className="text-link" href={`/attempts/${attempt.id}`}>Resume</Link> : null}</td></tr>)}</tbody></table></div>
          ) : <div className="empty-state"><p>{profileError ? "Profile details will appear after the database migration is applied." : "No saved exam attempts yet."}</p><Link className="text-link" href="/#levels">Explore the level formats <ArrowUpRight size={15} aria-hidden="true" /></Link></div>}
          {forms?.length ? <p className="data-footnote">Published mock forms are available for: {Array.from(new Set(forms.map((form) => form.level))).join(", ")}.</p> : null}
        </PaperPanel>
      </ProductSection>
      <ProductSection title="Account" className="product-section--compact"><PaperPanel className="account-strip"><span>Signed in as <strong>{user.email ?? user.phone}</strong></span><div className="account-strip__actions"><Link className="btn btn--secondary" href="/settings">Account settings</Link><Link className="btn btn--secondary" href="/subscription">Plan and access</Link><SignOutButton /></div></PaperPanel></ProductSection>
    </ProductPage>
  );
}
