import Link from "next/link";
import { ArrowUpRight, Trophy } from "lucide-react";
import { LocalizedText } from "@/components/i18n/localized-text";
import { PaperPanel, ProductPage, ProductSection } from "@/components/product-page";
import { requireSignedInUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const levels = ["N1", "N2", "N3", "N4", "N5"] as const;
const periods = ["all_time", "7d", "30d"] as const;
type Level = (typeof levels)[number];
type Period = (typeof periods)[number];
type BoardRow = {
  rank: number;
  learner_alias: string;
  level: Level;
  raw_correct: number;
  total_questions: number;
  score_percent: number;
  submitted_at: string;
  is_current_user: boolean;
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LeaderboardPage({ searchParams }: {
  searchParams: Promise<{ level?: string | string[]; period?: string | string[] }>;
}) {
  const params = await searchParams;
  const { supabase, user } = await requireSignedInUser("/leaderboard");
  if (!supabase || !user) {
    return <ProductPage eyebrow="Learner community" title="Leaderboard" description="Connect Supabase and sign in to compare completed mock exam results." eyebrowKey="leaderboard.eyebrow" titleKey="leaderboard.title" descriptionKey="leaderboard.description">
      <ProductSection title="Rankings" titleKey="leaderboard.rankings"><PaperPanel><Link className="btn btn--primary" href="/auth/login?next=%2Fleaderboard">Sign in</Link></PaperPanel></ProductSection>
    </ProductPage>;
  }

  const { data: profile } = await supabase.from("profiles").select("target_level").eq("user_id", user.id).maybeSingle();
  const requestedLevel = first(params.level);
  const selectedLevel: Level = levels.includes(requestedLevel as Level)
    ? requestedLevel as Level
    : levels.includes(profile?.target_level as Level) ? profile!.target_level as Level : "N5";
  const requestedPeriod = first(params.period);
  const selectedPeriod: Period = periods.includes(requestedPeriod as Period) ? requestedPeriod as Period : "all_time";
  const { data, error } = await supabase.rpc("get_student_leaderboard", {
    p_level: selectedLevel,
    p_period: selectedPeriod,
    p_limit: 10,
  });
  const rows = (data ?? []) as BoardRow[];

  return <ProductPage eyebrow="Learner community" title="Leaderboard" description="Compare completed mock exam results with other learners at your JLPT level." eyebrowKey="leaderboard.eyebrow" titleKey="leaderboard.title" descriptionKey="leaderboard.description" className="product-page--dashboard">
    <ProductSection title="Rankings" titleKey="leaderboard.rankings" className="product-section--tint">
      <PaperPanel className="data-panel leaderboard-panel">
        <form action="/leaderboard" method="get" className="leaderboard-filter">
          <label><LocalizedText messageKey="leaderboard.level" /><select name="level" defaultValue={selectedLevel}>{levels.map((level) => <option key={level} value={level}>{level}</option>)}</select></label>
          <label><LocalizedText messageKey="leaderboard.period" /><select name="period" defaultValue={selectedPeriod}><option value="all_time"><LocalizedText messageKey="leaderboard.allTime" /></option><option value="7d"><LocalizedText messageKey="leaderboard.lastSevenDays" /></option><option value="30d"><LocalizedText messageKey="leaderboard.lastThirtyDays" /></option></select></label>
          <button className="btn btn--primary" type="submit"><LocalizedText messageKey="leaderboard.apply" /></button>
        </form>

        {error ? <p className="inline-notice" role="alert"><LocalizedText messageKey="leaderboard.unavailable" /></p> : rows.length ? <div className="table-scroll leaderboard-table-wrap">
          <table className="leaderboard-table">
            <thead><tr><th scope="col"><LocalizedText messageKey="leaderboard.rank" /></th><th scope="col"><LocalizedText messageKey="leaderboard.learner" /></th><th scope="col"><LocalizedText messageKey="leaderboard.score" /></th><th scope="col"><LocalizedText messageKey="leaderboard.result" /></th><th scope="col"><LocalizedText messageKey="leaderboard.completed" /></th></tr></thead>
            <tbody>{rows.map((row) => <tr className={row.is_current_user ? "is-current-user" : undefined} key={`${row.rank}-${row.learner_alias}`}>
              <td><span className="leaderboard-rank">{row.rank}</span></td>
              <td>{row.learner_alias}{row.is_current_user ? <span className="leaderboard-you"> · <LocalizedText messageKey="leaderboard.you" /></span> : null}</td>
              <td><strong>{Number(row.score_percent).toFixed(1)}%</strong></td>
              <td>{row.raw_correct} / {row.total_questions}</td>
              <td>{new Date(row.submitted_at).toLocaleDateString("en", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" })}</td>
            </tr>)}</tbody>
          </table>
        </div> : <div className="empty-state"><p><LocalizedText messageKey="leaderboard.empty" /></p><Link className="text-link" href="/exams"><LocalizedText messageKey="dashboard.openExams" /> <ArrowUpRight size={15} aria-hidden="true" /></Link></div>}

        <div className="leaderboard-notes"><p><Trophy size={16} aria-hidden="true" /><span><LocalizedText messageKey="leaderboard.scoring" /></span></p><p><span><LocalizedText messageKey="leaderboard.privacy" /></span></p></div>
      </PaperPanel>
    </ProductSection>
  </ProductPage>;
}
