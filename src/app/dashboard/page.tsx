import Link from "next/link";
import { ArrowUpRight, Bookmark, BookOpen, Clock3, RotateCcw } from "lucide-react";
import { ProductPage, ProductSection, PaperPanel } from "@/components/product-page";
import { SignOutButton } from "@/components/sign-out-button";
import { requireSignedInUser } from "@/lib/auth";
import { isLocalDemoEnvironment } from "@/lib/local-demo";
import { LocalizedText } from "@/components/i18n/localized-text";
import type { MessageKey } from "@/lib/i18n";

export const metadata = { title: "Learner dashboard · JLPT practice" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const demoMode = isLocalDemoEnvironment();
  const { supabase, user } = await requireSignedInUser("/dashboard");
  if (!supabase || !user) {
    return <ProductPage eyebrow="Learner dashboard" eyebrowKey="dashboard.eyebrow" title="Your practice space" titleKey="dashboard.setupTitle" description="Connect the Supabase project to sign in and load saved learner data." descriptionKey="dashboard.setupDescription"><ProductSection title="Supabase setup required" titleKey="dashboard.setupRequired"><PaperPanel><p><LocalizedText messageKey="dashboard.setupMigrations" /></p><Link className="btn btn--primary" href="/auth/login"><LocalizedText messageKey="dashboard.continueSignIn" /></Link></PaperPanel></ProductSection></ProductPage>;
  }

  const [{ data: profile, error: profileError }, { data: attempts, error: attemptsError }, { data: forms }, { data: showWelcome }] = await Promise.all([
    supabase.from("profiles").select("display_name,target_level,ui_language,preferred_timezone").eq("user_id", user.id).maybeSingle(),
    supabase.from("exam_attempts").select("id,level,status,created_at,submitted_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5),
    supabase.from("exam_forms").select("id,level,form_code").eq("status", "published").order("created_at", { ascending: false }).limit(8),
    supabase.rpc("claim_welcome_message"),
  ]);
  const activeAttempt = attempts?.find((attempt) => attempt.status === "in_progress");
  const language = profile?.ui_language === "bn" ? "bn-BD" : "en";
  const stateKey: Record<string, MessageKey> = { submitted: "common.submitted", expired: "common.expired", in_progress: "common.inProgress", created: "common.pending" };

  return (
    <ProductPage eyebrow="Learner dashboard" eyebrowKey="dashboard.eyebrow" title="Welcome back" titleKey={profile?.display_name ? "dashboard.greeting" : "dashboard.welcomeBack"} titleValues={profile?.display_name ? { name: profile.display_name } : undefined} description="Choose a level, see saved attempts, and return to questions you want to review." descriptionKey="dashboard.description" className="product-page--dashboard">
      {demoMode ? <ProductSection title="Local test shortcuts" titleKey="demo.quickTitle" className="product-section--compact"><p className="demo-shortcuts__intro"><LocalizedText messageKey="demo.quickDescription" /></p><div className="demo-shortcuts-grid">
        <Link href="/exams"><LocalizedText messageKey="exams.title" /><ArrowUpRight size={15} aria-hidden="true" /></Link>
        <Link href="/practice"><LocalizedText messageKey="practice.title" /><ArrowUpRight size={15} aria-hidden="true" /></Link>
        <Link href="/progress"><LocalizedText messageKey="progress.title" /><ArrowUpRight size={15} aria-hidden="true" /></Link>
        <Link href="/review/47000000-0000-4000-8000-000000000001"><LocalizedText messageKey="results.reviewAnswers" /><ArrowUpRight size={15} aria-hidden="true" /></Link>
        <Link href="/mistakes"><LocalizedText messageKey="account.mistakes" /><ArrowUpRight size={15} aria-hidden="true" /></Link>
        <Link href="/bookmarks"><LocalizedText messageKey="bookmarks.title" /><ArrowUpRight size={15} aria-hidden="true" /></Link>
        <Link href="/pricing"><LocalizedText messageKey="pricing.demoCheckout" /><ArrowUpRight size={15} aria-hidden="true" /></Link>
        <Link href="/support"><LocalizedText messageKey="account.support" /><ArrowUpRight size={15} aria-hidden="true" /></Link>
        <Link href="/notifications"><LocalizedText messageKey="notifications.inboxSection" /><ArrowUpRight size={15} aria-hidden="true" /></Link>
        <Link href="/account"><LocalizedText messageKey="settings.profileTitle" /><ArrowUpRight size={15} aria-hidden="true" /></Link>
      </div></ProductSection> : null}
      {showWelcome ? <ProductSection title="A new practice space" titleKey="dashboard.welcomeEyebrow" className="product-section--tint"><PaperPanel className="welcome-card"><span className="paper-tab"><LocalizedText messageKey="dashboard.accountReady" /></span><h2><LocalizedText messageKey={profile?.display_name ? "dashboard.greeting" : "dashboard.welcomeToPlatform"} values={profile?.display_name ? { name: profile.display_name } : undefined} />.</h2><p><LocalizedText messageKey="dashboard.welcomeDescription" /></p><Link className="btn btn--secondary" href="/account"><LocalizedText messageKey="dashboard.setupProfile" /></Link></PaperPanel></ProductSection> : null}
      {activeAttempt ? <ProductSection title="Continue your exam" titleKey="dashboard.continueExam" className="product-section--tint"><PaperPanel className="welcome-card"><span className="paper-tab"><LocalizedText messageKey="dashboard.activeAttempt" /></span><h2>JLPT {activeAttempt.level}</h2><p><LocalizedText messageKey="dashboard.resumeDescription" /></p><Link className="btn btn--primary" href={`/attempts/${activeAttempt.id}`}><LocalizedText messageKey="dashboard.continueExam" /> <ArrowUpRight size={15} aria-hidden="true" /></Link></PaperPanel></ProductSection> : null}
      <ProductSection title="Your next step" titleKey="dashboard.nextStep" className="product-section--tint">
        <div className="dashboard-grid">
          <PaperPanel className="action-panel"><span className="panel-icon"><BookOpen aria-hidden="true" /></span><h3><LocalizedText messageKey="dashboard.exploreLevel" /></h3><p>{profile?.target_level ? <><LocalizedText messageKey="dashboard.targetLevel" /> {profile.target_level}.</> : <LocalizedText messageKey="dashboard.chooseLevel" />}</p><Link className="text-link" href={profile?.target_level ? `/levels/${profile.target_level}` : "/#levels"}><LocalizedText messageKey="dashboard.levelDetails" /> <ArrowUpRight size={15} aria-hidden="true" /></Link></PaperPanel>
          <PaperPanel className="action-panel"><span className="panel-icon"><RotateCcw aria-hidden="true" /></span><h3><LocalizedText messageKey="dashboard.reviewMistakes" /></h3><p><LocalizedText messageKey="dashboard.reviewMistakesDescription" /></p><Link className="text-link" href="/mistakes"><LocalizedText messageKey="dashboard.openNotebook" /> <ArrowUpRight size={15} aria-hidden="true" /></Link></PaperPanel>
          <PaperPanel className="action-panel"><span className="panel-icon"><Bookmark aria-hidden="true" /></span><h3><LocalizedText messageKey="dashboard.savedQuestions" /></h3><p><LocalizedText messageKey="dashboard.savedQuestionsDescription" /></p><Link className="text-link" href="/bookmarks"><LocalizedText messageKey="dashboard.openBookmarks" /> <ArrowUpRight size={15} aria-hidden="true" /></Link></PaperPanel>
          <PaperPanel className="action-panel"><span className="panel-icon"><Clock3 aria-hidden="true" /></span><h3><LocalizedText messageKey="dashboard.interfacePreview" /></h3><p><LocalizedText messageKey="dashboard.previewDescription" /></p><Link className="text-link" href="/exams/n5/preview"><LocalizedText messageKey="dashboard.openPreview" /> <ArrowUpRight size={15} aria-hidden="true" /></Link></PaperPanel>
          <PaperPanel className="action-panel"><span className="panel-icon"><BookOpen aria-hidden="true" /></span><h3><LocalizedText messageKey="dashboard.browseExams" /></h3><p><LocalizedText messageKey="dashboard.browseDescription" /></p><Link className="text-link" href="/exams"><LocalizedText messageKey="dashboard.openLibrary" /> <ArrowUpRight size={15} aria-hidden="true" /></Link></PaperPanel>
          <PaperPanel className="action-panel"><span className="panel-icon"><BookOpen aria-hidden="true" /></span><h3><LocalizedText messageKey="practice.title" /></h3><p><LocalizedText messageKey="practice.description" /></p><Link className="text-link" href="/practice"><LocalizedText messageKey="practice.start" /> <ArrowUpRight size={15} aria-hidden="true" /></Link></PaperPanel>
        </div>
      </ProductSection>
      <ProductSection title="Recent attempts" titleKey="dashboard.recentAttempts">
        <PaperPanel className="data-panel">
          {attemptsError ? <p className="inline-notice"><LocalizedText messageKey="dashboard.attemptsUnavailable" /></p> : attempts?.length ? (
            <div className="table-scroll"><table><thead><tr><th><LocalizedText messageKey="dashboard.level" /></th><th><LocalizedText messageKey="dashboard.status" /></th><th><LocalizedText messageKey="dashboard.started" /></th><th></th></tr></thead><tbody>{attempts.map((attempt) => <tr key={attempt.id}><td>{["submitted", "expired"].includes(attempt.status) ? <Link className="text-link" href={`/results/${attempt.id}`}>{attempt.level}</Link> : attempt.level}</td><td><span className="status-chip"><LocalizedText messageKey={stateKey[attempt.status] ?? "common.unknown"} /></span></td><td>{new Date(attempt.created_at).toLocaleDateString(language, { year: "numeric", month: "short", day: "numeric", timeZone: profile?.preferred_timezone ?? "Asia/Dhaka" })}</td><td>{attempt.status === "in_progress" ? <Link className="text-link" href={`/attempts/${attempt.id}`}><LocalizedText messageKey="dashboard.resume" /></Link> : null}</td></tr>)}</tbody></table></div>
          ) : <div className="empty-state"><p><LocalizedText messageKey={profileError ? "dashboard.profilePending" : "dashboard.noAttempts"} /></p><Link className="text-link" href="/#levels"><LocalizedText messageKey="dashboard.levelDetails" /> <ArrowUpRight size={15} aria-hidden="true" /></Link></div>}
          {forms?.length ? <p className="data-footnote"><LocalizedText messageKey="dashboard.publishedLevels" /> {Array.from(new Set(forms.map((form) => form.level))).join(", ")}.</p> : null}
        </PaperPanel>
      </ProductSection>
      <ProductSection title="Account" titleKey="dashboard.account" className="product-section--compact"><PaperPanel className="account-strip"><span><LocalizedText messageKey="dashboard.signedInAs" /> <strong>{user.email ?? user.phone}</strong></span><div className="account-strip__actions"><Link className="btn btn--secondary" href="/settings"><LocalizedText messageKey="dashboard.settings" /></Link><Link className="btn btn--secondary" href="/subscription"><LocalizedText messageKey="dashboard.planAccess" /></Link><SignOutButton /></div></PaperPanel></ProductSection>
    </ProductPage>
  );
}
