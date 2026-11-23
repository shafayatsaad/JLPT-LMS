import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, Check, CircleHelp } from "lucide-react";
import { PaperPanel, ProductPage, ProductSection } from "@/components/product-page";
import { LocalizedText } from "@/components/i18n/localized-text";
import { requireSignedInUser } from "@/lib/auth";
import { BookmarkButton } from "@/components/bookmark-button";

export const dynamic = "force-dynamic";

type ReviewRow = {
  question_id: string;
  level: string;
  prompt: unknown;
  options: unknown;
  selected_option_id: string | null;
  correct_option_id: string;
  explanation: unknown;
};

function blockText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value.map((part) => {
      if (!part || typeof part !== "object") return "";
      const block = part as Record<string, unknown>;
      if (block.type === "text") return String(block.text ?? "");
      if (block.type === "audio") return "Listening item";
      if (block.type === "image") return String(block.alt ?? "Image item");
      return "";
    }).filter(Boolean).join(" ");
  }
  if (value && typeof value === "object") return blockText((value as Record<string, unknown>).content ?? (value as Record<string, unknown>).text ?? "");
  return "";
}

function optionRows(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((option) => {
    if (!option || typeof option !== "object") return [];
    const item = option as Record<string, unknown>;
    return [{ id: String(item.id ?? ""), text: blockText(item.content) }];
  });
}

function explanationText(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const object = value as Record<string, unknown>;
  return typeof object.correctAnswer === "string" ? object.correctAnswer : null;
}

function distractorRows(value: unknown) {
  if (!value || typeof value !== "object" || !Array.isArray((value as Record<string, unknown>).distractors)) return [];
  return ((value as Record<string, unknown>).distractors as unknown[]).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    return [{ optionId: String(row.optionId ?? ""), rationale: String(row.rationale ?? "") }];
  });
}

export default async function AttemptReviewPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  const { supabase, user } = await requireSignedInUser(`/review/${attemptId}`);
  if (!supabase || !user) {
    return <ProductPage eyebrow="Answer review" eyebrowKey="review.eyebrow" title="Review a completed attempt" titleKey="review.title" description="Connect Supabase and sign in to request the answer review for a saved attempt." descriptionKey="review.description"><ProductSection title="Supabase setup required" titleKey="results.setupTitle"><PaperPanel><p><LocalizedText messageKey="review.setupMessage" /></p><Link className="btn btn--primary" href="/auth/login"><LocalizedText messageKey="results.signIn" /></Link></PaperPanel></ProductSection></ProductPage>;
  }

  const { data: attempt, error: attemptError } = await supabase.from("exam_attempts").select("id,level,status").eq("id", attemptId).eq("user_id", user.id).maybeSingle();
  if (!attempt && !attemptError) notFound();
  const closed = attempt && ["submitted", "expired"].includes(attempt.status);
  const review = closed ? await supabase.rpc("get_attempt_review", { p_attempt_id: attemptId }) : { data: null, error: null };
  const rows = (review.data ?? []) as ReviewRow[];
  const bookmarkResult = rows.length
    ? await supabase.from("user_bookmarks").select("question_id").eq("user_id", user.id).in("question_id", rows.map((row) => row.question_id))
    : { data: [], error: null };
  const bookmarkedIds = new Set((bookmarkResult.data ?? []).map((item) => item.question_id));

  return (
    <ProductPage eyebrow="Answer review" eyebrowKey="review.eyebrow" title="Review your answers" titleKey="review.title" description="Correct answers and explanations are released only after a saved attempt is submitted or expired." descriptionKey="review.description" className="product-page--dashboard">
      <ProductSection title="Completed attempt review" titleKey="review.completedTitle" className="product-section--tint">
        {attemptError || review.error ? <PaperPanel><p className="inline-notice"><LocalizedText messageKey="review.loadError" /></p></PaperPanel> : !closed ? <PaperPanel><p><LocalizedText messageKey="review.activeAttempt" /></p></PaperPanel> : !rows.length ? <PaperPanel><p><LocalizedText messageKey="review.noItems" /></p></PaperPanel> : <div className="answer-review-list">{rows.map((row, index) => {
          const options = optionRows(row.options);
          const chosen = options.find((option) => option.id === row.selected_option_id);
          const correct = options.find((option) => option.id === row.correct_option_id);
          return <article className="answer-review-card origami-answer-card" id={`question-${row.question_id}`} key={row.question_id}>
            <div className="answer-review-card__head"><span>{String(index + 1).padStart(2, "0")} · {row.level}</span><span className={row.selected_option_id === row.correct_option_id ? "review-status review-status--correct" : "review-status review-status--wrong"}><LocalizedText messageKey={row.selected_option_id === row.correct_option_id ? "review.correct" : row.selected_option_id ? "review.reviewThis" : "review.unanswered"} /></span></div>
            <h2 lang="ja">{blockText(row.prompt)}</h2>
            <div className="answer-review-card__answers"><p><span><LocalizedText messageKey="review.yourResponse" /></span><strong>{chosen ? `${chosen.id} · ${chosen.text}` : <LocalizedText messageKey="review.noResponse" />}</strong></p><p><span><LocalizedText messageKey="review.correctAnswer" /></span><strong><Check size={15} aria-hidden="true" /> {correct ? `${correct.id} · ${correct.text}` : row.correct_option_id}</strong></p></div>
            <div className="answer-review-card__explanation"><CircleHelp size={17} aria-hidden="true" /><p>{explanationText(row.explanation) ?? <LocalizedText messageKey="review.noExplanation" />}</p></div>
            {distractorRows(row.explanation).length > 0 && <ul className="review-rationales">{distractorRows(row.explanation).map((item) => <li key={item.optionId}><strong>{item.optionId}</strong><span>{item.rationale}</span></li>)}</ul>}
            <BookmarkButton questionId={row.question_id} initiallyBookmarked={bookmarkedIds.has(row.question_id)} />
          </article>;
        })}</div>}
      </ProductSection>
      <ProductSection title="Continue" titleKey="review.continue" className="product-section--compact"><PaperPanel><Link className="text-link" href={`/results/${attemptId}`}><LocalizedText messageKey="review.returnResult" /> <ArrowUpRight size={15} aria-hidden="true" /></Link><span className="link-separator">·</span><Link className="text-link" href="/dashboard"><LocalizedText messageKey="review.dashboard" /> <ArrowUpRight size={15} aria-hidden="true" /></Link></PaperPanel></ProductSection>
    </ProductPage>
  );
}
