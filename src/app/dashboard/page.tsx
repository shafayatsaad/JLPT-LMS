import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowUpRight, BookOpen, RotateCcw, Trophy } from "lucide-react";
import { ProductPage, ProductSection, PaperPanel } from "@/components/product-page";
import { requireSignedInUser } from "@/lib/auth";
import { LocalizedText } from "@/components/i18n/localized-text";
import type { MessageKey } from "@/lib/i18n";
import { isLocalDemoEnvironment, isLocalQaExamFormCode } from "@/lib/local-demo";

export const metadata = { title: "Learner dashboard · JLPT practice" };
export const dynamic = "force-dynamic";

const staffRoles = new Set(["content_editor", "reviewer", "payment_reviewer", "support_agent", "admin"]);
const levels = ["N1", "N2", "N3", "N4", "N5"] as const;

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ view?: string | string[] }> }) {
  const params = await searchParams;
  const learnerView = (Array.isArray(params.view) ? params.view[0] : params.view) === "learner";
  const { supabase, user } = await requireSignedInUser("/dashboard");
  if (!supabase || !user) {
    return <ProductPage eyebrow="Learner dashboard" eyebrowKey="dashboard.eyebrow" title="Your practice space" titleKey="dashboard.setupTitle" description="Connect the Supabase project to sign in and load saved learner data." descriptionKey="dashboard.setupDescription"><ProductSection title="Supabase setup required" titleKey="dashboard.setupRequired"><PaperPanel><p><LocalizedText messageKey="dashboard.setupMigrations" /></p><Link className="btn btn--primary" href="/auth/login"><LocalizedText messageKey="dashboard.continueSignIn" /></Link></PaperPanel></ProductSection></ProductPage>;
  }

  const { data: roleRows, error: rolesError } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  if (rolesError) {
    return <ProductPage eyebrow="Learner dashboard" title="Workspace unavailable" description="We could not confirm which workspace belongs to this account. Refresh the page or try again shortly." className="product-page--dashboard"><ProductSection title="Account access"><PaperPanel><p className="inline-notice" role="alert">Your session is still active. The workspace check failed, so no dashboard data was loaded.</p><Link className="btn btn--secondary" href="/auth/login">Return to sign in</Link></PaperPanel></ProductSection></ProductPage>;
  }
  if (!learnerView && roleRows?.some((row) => staffRoles.has(row.role))) redirect("/admin");

  const [{ data: profile }, { data: attempts, error: attemptsError }, { data: forms, error: formsError }, { data: entitlements, error: entitlementError }, { data: showWelcome }, { data: mistakes, error: mistakesError }] = await Promise.all([
    supabase.from("profiles").select("display_name,target_level,ui_language,preferred_timezone").eq("user_id", user.id).maybeSingle(),
    supabase.from("exam_attempts").select("id,level,status,created_at,submitted_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10),
    supabase.from("exam_forms").select("id,level,form_code,access_tier").eq("status", "published").order("created_at", { ascending: false }).limit(50),
    supabase.from("user_entitlements").select("status,starts_at,ends_at").eq("user_id", user.id).limit(20),
    supabase.rpc("claim_welcome_message"),
    supabase.rpc("get_my_mistake_notebook", {
      p_level: null,
      p_tag_slug: null,
      p_item_type_code: null,
      p_from: null,
      p_to: null,
      p_timezone: "Asia/Dhaka",
      p_reviewed: false,
      p_limit: 1,
    }),
  ]);
  const learnerForms = isLocalDemoEnvironment() ? forms?.filter((form) => !isLocalQaExamFormCode(form.form_code)) : forms;
  const leaderboardLevel = levels.includes(profile?.target_level as (typeof levels)[number]) ? profile!.target_level! : "N5";
  const { data: leaderboardData, error: leaderboardError } = await supabase.rpc("get_student_leaderboard", {
    p_level: leaderboardLevel,
    p_period: "all_time",
    p_limit: 3,
  });
  const leaderboardRows = (leaderboardData ?? []) as Array<{ rank: number; learner_alias: string; score_percent: number; is_current_user: boolean }>;
  const activeAttempt = attempts?.find((attempt) => attempt.status === "in_progress");
  const completedAttempts = (attempts ?? []).filter((attempt) => ["submitted", "expired"].includes(attempt.status)).slice(0, 3);
  const language = profile?.ui_language === "bn" ? "bn-BD" : "en";
  const timeZone = profile?.preferred_timezone ?? "Asia/Dhaka";
  const stateKey: Record<string, MessageKey> = { submitted: "common.submitted", expired: "common.expired" };
  // Entitlement eligibility is calculated on the server at request time.
  // eslint-disable-next-line react-hooks/purity -- Wall-clock time is required for access windows.
  const now = Date.now();
  const hasPremiumAccess = (entitlements ?? []).some((item) => item.status === "active" && Date.parse(item.starts_at) <= now && Date.parse(item.ends_at) > now);
  const availableByLevel = levels.flatMap((level) => {
    const levelForms = (learnerForms ?? []).filter((form) => form.level === level);
    if (!levelForms.length) return [];
    const eligible = levelForms.filter((form) => form.access_tier === "free" || hasPremiumAccess).length;
    return [{ level, total: levelForms.length, eligible }];
  });

  return (
    <ProductPage eyebrow="Learner dashboard" eyebrowKey="dashboard.eyebrow" title="Welcome back" titleKey={profile?.display_name ? "dashboard.greeting" : "dashboard.welcomeBack"} titleValues={profile?.display_name ? { name: profile.display_name } : undefined} description="Your next exam, practice set, and saved results in one place." descriptionKey="dashboard.description" className="product-page--dashboard">
      {showWelcome ? <p className="student-dashboard-welcome" role="status"><LocalizedText messageKey="dashboard.accountReady" /> · <LocalizedText messageKey="dashboard.welcomeDescription" /></p> : null}

      <ProductSection title="Continue" titleKey="dashboard.continueSection" className="product-section--tint">
        <PaperPanel className="student-dashboard-feature">
          {activeAttempt ? <>
            <div><span className="status-chip"><LocalizedText messageKey="dashboard.activeAttempt" /></span><h2>JLPT {activeAttempt.level}</h2><p><LocalizedText messageKey="dashboard.resumeDescription" /></p></div>
            <Link className="btn btn--primary" href={`/attempts/${activeAttempt.id}`}><LocalizedText messageKey="dashboard.continueExam" /> <ArrowUpRight size={15} aria-hidden="true" /></Link>
          </> : <>
            <div><span className="panel-icon"><RotateCcw aria-hidden="true" /></span><h2><LocalizedText messageKey="dashboard.continueNothingTitle" /></h2><p><LocalizedText messageKey="dashboard.continueNothingBody" /></p></div>
          </>}
        </PaperPanel>
      </ProductSection>

      <ProductSection title="Mock exams" titleKey="dashboard.mockExamSection" className="product-section--tint">
        <div className="student-dashboard-exams">
          <PaperPanel className="student-dashboard-action"><span className="panel-icon"><BookOpen aria-hidden="true" /></span><h2><LocalizedText messageKey="dashboard.startExamTitle" /></h2><p><LocalizedText messageKey="dashboard.startExamBody" /></p><Link className="btn btn--primary" href="/exams"><LocalizedText messageKey="dashboard.openExams" /> <ArrowUpRight size={15} aria-hidden="true" /></Link></PaperPanel>
          <PaperPanel className="data-panel student-dashboard-levels"><h3><LocalizedText messageKey="dashboard.availableExams" /></h3>
            {formsError ? <p className="inline-notice"><LocalizedText messageKey="exams.unavailable" /></p> : availableByLevel.length ? <ul className="student-dashboard-level-list">{availableByLevel.map(({ level, total, eligible }) => <li key={level}><span><strong>{level}</strong><small>{entitlementError ? <LocalizedText messageKey="dashboard.eligibilityUnavailable" /> : eligible ? <LocalizedText messageKey="dashboard.availableLevelStatus" values={{ total, eligible }} /> : <LocalizedText messageKey="dashboard.premiumRequired" />}</small></span><Link className="text-link" href={`/exams?level=${level}`}><LocalizedText messageKey="dashboard.openExams" /> <ArrowUpRight size={14} aria-hidden="true" /></Link></li>)}</ul> : <div className="empty-state"><p><LocalizedText messageKey="dashboard.noPublishedExams" /></p><Link className="text-link" href="/exams/n5/preview"><LocalizedText messageKey="dashboard.previewPaper" /> <ArrowUpRight size={14} aria-hidden="true" /></Link><p className="data-footnote"><LocalizedText messageKey="dashboard.previewNotScored" /></p></div>}
          </PaperPanel>
        </div>
      </ProductSection>

      <ProductSection title="Practice" titleKey="dashboard.practiceSection">
        <PaperPanel className="student-dashboard-practice"><div><p><LocalizedText messageKey="dashboard.practiceSkillBody" /></p></div><div className="student-dashboard-level-actions">{levels.map((level) => <Link className="btn btn--secondary" href={`/practice?level=${level}`} key={level}>{level}<ArrowUpRight size={14} aria-hidden="true" /></Link>)}</div></PaperPanel>
      </ProductSection>

      <ProductSection title="Recent results" titleKey="dashboard.recentResults" className="product-section--tint">
        <PaperPanel className="data-panel">
          {attemptsError ? <p className="inline-notice"><LocalizedText messageKey="dashboard.attemptsUnavailable" /></p> : completedAttempts.length ? <div className="table-scroll"><table><thead><tr><th><LocalizedText messageKey="dashboard.level" /></th><th><LocalizedText messageKey="dashboard.status" /></th><th><LocalizedText messageKey="dashboard.started" /></th><th></th></tr></thead><tbody>{completedAttempts.map((attempt) => <tr key={attempt.id}><td>{attempt.level}</td><td><span className="status-chip"><LocalizedText messageKey={stateKey[attempt.status] ?? "common.unknown"} /></span></td><td>{new Date(attempt.created_at).toLocaleDateString(language, { year: "numeric", month: "short", day: "numeric", timeZone })}</td><td><Link className="text-link" href={`/results/${attempt.id}`}><LocalizedText messageKey="progress.openResult" /> <ArrowUpRight size={14} aria-hidden="true" /></Link></td></tr>)}</tbody></table></div> : <div className="empty-state"><p><LocalizedText messageKey="dashboard.recentResultsEmpty" /></p><Link className="text-link" href="/exams"><LocalizedText messageKey="dashboard.openExams" /> <ArrowUpRight size={14} aria-hidden="true" /></Link></div>}
          <p className="data-footnote"><Link className="text-link" href="/progress"><LocalizedText messageKey="dashboard.viewAllResults" /> <ArrowUpRight size={14} aria-hidden="true" /></Link></p>
        </PaperPanel>
      </ProductSection>

      <ProductSection title="Mistake review" titleKey="dashboard.reviewMistakes" className="product-section--compact">
        <PaperPanel className="student-dashboard-review"><div><span className="panel-icon"><RotateCcw aria-hidden="true" /></span><p>{mistakesError ? <LocalizedText messageKey="dashboard.mistakesUnavailable" /> : mistakes?.length ? <LocalizedText messageKey="dashboard.mistakesAvailable" /> : <LocalizedText messageKey="dashboard.mistakesEmpty" />}</p></div><Link className="btn btn--secondary" href="/mistakes"><LocalizedText messageKey="dashboard.openMistakes" /> <ArrowUpRight size={15} aria-hidden="true" /></Link></PaperPanel>
      </ProductSection>

      <ProductSection title="Leaderboard" titleKey="dashboard.leaderboard" className="product-section--compact">
        <PaperPanel className="data-panel student-dashboard-leaderboard">
          {leaderboardError ? <p className="inline-notice"><LocalizedText messageKey="dashboard.leaderboardError" /></p> : leaderboardRows.length ? <ol>{leaderboardRows.map((row) => <li key={row.rank}><span><strong>#{row.rank}</strong> {row.learner_alias}{row.is_current_user ? <span className="leaderboard-you"> · <LocalizedText messageKey="leaderboard.you" /></span> : null}</span><strong>{Number(row.score_percent).toFixed(1)}%</strong></li>)}</ol> : <div className="empty-state"><p><LocalizedText messageKey="dashboard.leaderboardEmpty" /></p><Link className="text-link" href="/exams"><LocalizedText messageKey="dashboard.openExams" /> <ArrowUpRight size={14} aria-hidden="true" /></Link></div>}
          <Link className="btn btn--secondary" href="/leaderboard"><Trophy size={15} aria-hidden="true" /> <LocalizedText messageKey="dashboard.leaderboardView" /> <ArrowUpRight size={14} aria-hidden="true" /></Link>
        </PaperPanel>
      </ProductSection>
    </ProductPage>
  );
}
