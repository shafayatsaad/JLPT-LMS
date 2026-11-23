import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowUpRight, Check, CircleHelp } from "lucide-react";
import { BookmarkButton } from "@/components/bookmark-button";
import { LocalizedText } from "@/components/i18n/localized-text";
import { PaperPanel, ProductPage, ProductSection } from "@/components/product-page";
import { requireSignedInUser } from "@/lib/auth";
import type { TargetedPracticePayload } from "@/components/targeted-practice-session";

export const dynamic = "force-dynamic";

type PracticeReviewRow = {
  question_id: string;
  position: number;
  item_type_code: string;
  prompt: unknown;
  options: { id: string; content?: unknown; text?: unknown }[];
  selected_option_id: string | null;
  correct_option_id: string;
  explanation: unknown;
  distractor_rationales: unknown;
  is_correct: boolean;
};

function content(value: unknown): React.ReactNode {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map((part, index) => <span key={index}>{content(part)}</span>);
  if (!value || typeof value !== "object") return null;
  const block = value as Record<string, unknown>;
  if (block.type === "text") return String(block.text ?? block.value ?? "");
  if (block.type === "ruby") return <ruby>{content(block.base ?? block.text)}<rt>{content(block.reading ?? block.rt)}</rt></ruby>;
  if (block.type === "line_break") return <br />;
  if (block.type === "image") return <span>{String(block.alt ?? "Image material")}</span>;
  if ("content" in block) return content(block.content);
  if ("text" in block) return content(block.text);
  return null;
}

function localized(value: unknown, language: "en" | "bn") {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const object = value as Record<string, unknown>;
  const selected = object[language] ?? object.en ?? object.ja;
  return typeof selected === "string" ? selected : "";
}

export default async function TargetedPracticeReviewPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const { supabase, user } = await requireSignedInUser(`/practice/${sessionId}/review`);
  if (!supabase || !user) {
    return <ProductPage eyebrow="Targeted practice" eyebrowKey="practice.eyebrow" title="Practice review" titleKey="practice.reviewTitle" description="Sign in to see feedback from your submitted practice set." descriptionKey="practice.sessionDescription" className="product-page--dashboard"><ProductSection title="Practice access" titleKey="practice.completedSet"><PaperPanel><Link className="btn btn--primary" href={`/auth/login?next=${encodeURIComponent(`/practice/${sessionId}/review`)}`}><LocalizedText messageKey="common.signIn" /></Link></PaperPanel></ProductSection></ProductPage>;
  }

  const { data: sessionData, error: sessionError } = await supabase.rpc("get_targeted_practice_session", { p_session_id: sessionId });
  const payload = sessionData as TargetedPracticePayload | null;
  if (!payload && !sessionError) notFound();
  if (payload?.session.status === "in_progress") redirect(`/practice/${sessionId}`);
  const { data, error } = await supabase.rpc("get_targeted_practice_review", { p_session_id: sessionId });
  const rows = (data ?? []) as PracticeReviewRow[];
  const { data: profile } = await supabase.from("profiles").select("ui_language").eq("user_id", user.id).maybeSingle();
  const bookmarkResult = rows.length
    ? await supabase.from("user_bookmarks").select("question_id").eq("user_id", user.id).in("question_id", rows.map((row) => row.question_id))
    : { data: [], error: null };
  const bookmarked = new Set((bookmarkResult.data ?? []).map((item) => item.question_id));
  const language = profile?.ui_language === "bn" ? "bn" : "en";

  return (
    <ProductPage eyebrow="Targeted practice" eyebrowKey="practice.eyebrow" title="Practice review" titleKey="practice.reviewTitle" description="Review your responses and the prewritten explanations for this submitted practice set." descriptionKey="practice.sessionDescription" className="product-page--dashboard">
      <ProductSection title="Completed practice set" titleKey="practice.completedSet" className="product-section--tint">
        <PaperPanel className="data-panel">
          {sessionError || error || !payload ? <p className="inline-notice"><LocalizedText messageKey="practice.migration" /></p> : rows.length ? <>
            <div className="practice-result-summary">
              <p className="product-small-label">JLPT {payload.session.level} · {payload.session.tag_slug.replaceAll("-", " ")}</p>
              <h2><LocalizedText messageKey="practice.score" values={{ correct: payload.session.raw_correct ?? 0, total: payload.session.question_count }} /></h2>
            </div>
            <div className="answer-review-list">{rows.map((row) => {
              const chosen = row.options.find((option) => option.id === row.selected_option_id);
              const correct = row.options.find((option) => option.id === row.correct_option_id);
              const distractors = row.distractor_rationales && typeof row.distractor_rationales === "object" ? row.distractor_rationales as Record<string, unknown> : {};
              const explanation = localized(row.explanation, language);
              return <article className="answer-review-card origami-answer-card" key={row.question_id}>
                <div className="answer-review-card__head"><span>{String(row.position).padStart(2, "0")} · {row.item_type_code.replaceAll("-", " ")}</span><span className={row.is_correct ? "review-status review-status--correct" : "review-status review-status--wrong"}><LocalizedText messageKey={row.is_correct ? "practice.correct" : row.selected_option_id ? "practice.incorrect" : "practice.unanswered"} /></span></div>
                <h2 lang="ja">{content(row.prompt)}</h2>
                <div className="answer-review-card__answers">
                  <p><span><LocalizedText messageKey="practice.yourAnswer" /></span><strong>{chosen ? <>{chosen.id} · {content(chosen.content ?? chosen.text)}</> : <LocalizedText messageKey="practice.noAnswer" />}</strong></p>
                  <p><span><LocalizedText messageKey="practice.correctAnswer" /></span><strong><Check size={15} aria-hidden="true" /> {correct ? <>{correct.id} · {content(correct.content ?? correct.text)}</> : row.correct_option_id}</strong></p>
                </div>
                {explanation ? <div className="answer-review-card__explanation"><CircleHelp size={17} aria-hidden="true" /><p><strong><LocalizedText messageKey="practice.explanation" />:</strong> {explanation}</p></div> : null}
                {Object.keys(distractors).length ? <ul className="review-rationales">{Object.entries(distractors).map(([optionId, rationale]) => <li key={optionId}><strong>{optionId}</strong><span>{localized(rationale, language) || String(rationale)}</span></li>)}</ul> : null}
                <BookmarkButton questionId={row.question_id} initiallyBookmarked={bookmarked.has(row.question_id)} />
              </article>;
            })}</div>
          </> : <p className="inline-notice"><LocalizedText messageKey="practice.migration" /></p>}
          <p className="product-cta-row"><Link className="text-link" href="/practice"><LocalizedText messageKey="practice.backToPractice" /> <ArrowUpRight size={15} aria-hidden="true" /></Link></p>
        </PaperPanel>
      </ProductSection>
    </ProductPage>
  );
}
