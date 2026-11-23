import Link from "next/link";
import { ArrowUpRight, Bookmark } from "lucide-react";
import { BookmarkButton } from "@/components/bookmark-button";
import { LocalizedText } from "@/components/i18n/localized-text";
import { MistakeReviewToggle } from "@/components/mistake-review-toggle";
import { PaperPanel, ProductPage, ProductSection } from "@/components/product-page";
import { requireSignedInUser } from "@/lib/auth";
import type { JlptLevel } from "@/lib/jlpt-format";

export const metadata = { title: "Mistake notebook · JLPT practice" };
export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;
type MistakeRow = {
  question_id: string;
  attempt_id: string;
  level: JlptLevel;
  test_section_code: string;
  item_type_code: string;
  prompt: unknown;
  options: unknown;
  selected_option_id: string;
  correct_option_id: string;
  explanation: unknown;
  distractor_rationales: unknown;
  wrong_at: string;
  times_wrong: number;
  tag_slugs: string[];
  reviewed_at: string | null;
};

function queryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function blockText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map((part) => {
    if (!part || typeof part !== "object") return "";
    const block = part as Record<string, unknown>;
    if (block.type === "text") return String(block.text ?? "");
    if (block.type === "image") return String(block.alt ?? "Image item");
    if (block.type === "audio") return "Listening item";
    return "";
  }).filter(Boolean).join(" ");
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return blockText(record.content ?? record.text ?? "");
  }
  return "";
}

function optionsOf(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((option) => {
    if (!option || typeof option !== "object") return [];
    const record = option as Record<string, unknown>;
    return [{ id: String(record.id ?? ""), text: blockText(record.content) }];
  });
}

function explanationOf(value: unknown) {
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  return typeof record.correctAnswer === "string" ? record.correctAnswer : "";
}

export default async function MistakesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const query = await searchParams;
  const { supabase, user } = await requireSignedInUser("/mistakes");
  if (!supabase || !user) {
    return <ProductPage eyebrow="Mistake notebook" title="Review questions you have missed" description="Sign in to load your private question history."><ProductSection title="Your review list"><PaperPanel><p><LocalizedText messageKey="mistakes.signIn" /></p><Link className="btn btn--primary" href="/auth/login?next=%2Fmistakes"><LocalizedText messageKey="common.signIn" /></Link></PaperPanel></ProductSection></ProductPage>;
  }

  const rawLevel = queryValue(query.level);
  const level = ["N1", "N2", "N3", "N4", "N5"].includes(rawLevel) ? rawLevel as JlptLevel : null;
  const rawStatus = queryValue(query.status);
  const status = ["open", "reviewed"].includes(rawStatus) ? rawStatus : "all";
  const from = queryValue(query.from);
  const to = queryValue(query.to);
  const fromValue = validDate(from) ? from : null;
  const toValue = validDate(to) ? to : null;
  const selectedTag = queryValue(query.tag).trim().toLowerCase();
  const selectedType = queryValue(query.type).trim();
  const { data: profile } = await supabase.from("profiles").select("preferred_timezone,ui_language").eq("user_id", user.id).maybeSingle();
  const timezone = profile?.preferred_timezone ?? "Asia/Dhaka";

  const { data, error } = await supabase.rpc("get_my_mistake_notebook", {
    p_level: level,
    p_tag_slug: selectedTag || null,
    p_item_type_code: selectedType || null,
    p_from: fromValue,
    p_to: toValue,
    p_timezone: timezone,
    p_reviewed: status === "all" ? null : status === "reviewed",
    p_limit: 200,
  });
  const mistakes = (data ?? []) as MistakeRow[];
  const tagSlugs = Array.from(new Set(mistakes.flatMap((row) => row.tag_slugs ?? [])));
  const [tagResult, bookmarksResult] = await Promise.all([
    tagSlugs.length ? supabase.from("tags").select("slug,label").in("slug", tagSlugs) : Promise.resolve({ data: [], error: null }),
    mistakes.length ? supabase.from("user_bookmarks").select("question_id").eq("user_id", user.id).in("question_id", mistakes.map((row) => row.question_id)) : Promise.resolve({ data: [], error: null }),
  ]);
  const tagLabels = new Map((tagResult.data ?? []).map((tag) => [tag.slug, tag.label]));
  const bookmarked = new Set((bookmarksResult.data ?? []).map((row) => row.question_id));
  const filterDataError = Boolean(error);
  const displayedCount = mistakes.length;

  return (
    <ProductPage eyebrow="Mistake notebook" title="Return to questions that need work" description="Review incorrect answers from completed mocks, mark an item reviewed, and practise the same skill." className="product-page--dashboard">
      <ProductSection title="Your question history" className="product-section--tint">
        <PaperPanel className="data-panel">
          <form className="mistake-filters" method="get">
            <label><LocalizedText messageKey="mistakes.level" />
              <select name="level" defaultValue={level ?? ""}>
                <option value=""><LocalizedText messageKey="mistakes.anyLevel" /></option>
                {(["N1", "N2", "N3", "N4", "N5"] as JlptLevel[]).map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label><LocalizedText messageKey="mistakes.tag" />
              <select name="tag" defaultValue={selectedTag}>
                <option value=""><LocalizedText messageKey="mistakes.anyTag" /></option>
                {tagSlugs.map((slug) => <option key={slug} value={slug}>{tagLabels.get(slug) ?? slug}</option>)}
                {selectedTag && !tagSlugs.includes(selectedTag) ? <option value={selectedTag}>{tagLabels.get(selectedTag) ?? selectedTag}</option> : null}
              </select>
            </label>
            <label><LocalizedText messageKey="mistakes.questionType" />
              <input name="type" defaultValue={selectedType} placeholder="kanji-reading" />
            </label>
            <label><LocalizedText messageKey="mistakes.from" />
              <input name="from" type="date" defaultValue={validDate(from) ? from : ""} />
            </label>
            <label><LocalizedText messageKey="mistakes.to" />
              <input name="to" type="date" defaultValue={validDate(to) ? to : ""} />
            </label>
            <label><LocalizedText messageKey="mistakes.reviewState" />
              <select name="status" defaultValue={status}>
                <option value="all"><LocalizedText messageKey="mistakes.all" /></option>
                <option value="open"><LocalizedText messageKey="mistakes.unreviewed" /></option>
                <option value="reviewed"><LocalizedText messageKey="mistakes.reviewed" /></option>
              </select>
            </label>
            <div className="mistake-filters__actions">
              <button className="btn btn--primary" type="submit"><LocalizedText messageKey="mistakes.apply" /></button>
              <Link className="text-link" href="/mistakes"><LocalizedText messageKey="mistakes.clear" /></Link>
            </div>
          </form>

          {filterDataError ? <p className="inline-notice"><LocalizedText messageKey="mistakes.unavailable" /></p> : displayedCount ? (
            <div className="mistake-list">
              <p className="data-footnote"><LocalizedText messageKey="mistakes.resultCount" values={{ count: displayedCount }} /></p>
              {mistakes.map((item) => {
                const options = optionsOf(item.options);
                const chosen = options.find((option) => option.id === item.selected_option_id);
                const correct = options.find((option) => option.id === item.correct_option_id);
                const explanation = explanationOf(item.explanation);
                const tags = item.tag_slugs ?? [];
                const isReviewed = Boolean(item.reviewed_at && new Date(item.reviewed_at) >= new Date(item.wrong_at));
                return <article className="mistake-card origami-answer-card" key={item.question_id}>
                  <header className="mistake-card__head">
                    <div><p className="product-small-label">{item.level} · {item.test_section_code} · {item.item_type_code}</p><h2 lang="ja">{blockText(item.prompt) || item.question_id}</h2></div>
                    <span className={`review-status ${isReviewed ? "review-status--correct" : "review-status--wrong"}`}>{isReviewed ? <LocalizedText messageKey="mistakes.reviewed" /> : <LocalizedText messageKey="mistakes.unreviewed" />}</span>
                  </header>
                  <div className="mistake-card__meta">
                    <span><LocalizedText messageKey="mistakes.lastMissed" /> {new Date(item.wrong_at).toLocaleDateString(profile?.ui_language === "bn" ? "bn-BD" : "en", { timeZone: timezone, dateStyle: "medium" })}</span>
                    <span><LocalizedText messageKey="mistakes.timesMissed" values={{ count: item.times_wrong }} /></span>
                    {tags.map((slug) => <span className="origami-tag" key={slug}>{tagLabels.get(slug) ?? slug}</span>)}
                  </div>
                  <div className="mistake-card__answers">
                    <p><span><LocalizedText messageKey="mistakes.yourAnswer" /></span><strong>{chosen ? `${chosen.id} · ${chosen.text}` : item.selected_option_id}</strong></p>
                    <p><span><LocalizedText messageKey="mistakes.correctAnswer" /></span><strong>{correct ? `${correct.id} · ${correct.text}` : item.correct_option_id}</strong></p>
                  </div>
                  {explanation ? <div className="answer-review-card__explanation"><p><strong><LocalizedText messageKey="mistakes.explanation" /></strong> {explanation}</p></div> : null}
                  <footer className="mistake-card__actions">
                    <MistakeReviewToggle questionId={item.question_id} initiallyReviewed={isReviewed} />
                    <BookmarkButton questionId={item.question_id} initiallyBookmarked={bookmarked.has(item.question_id)} />
                    <Link className="text-link" href={`/review/${item.attempt_id}#question-${item.question_id}`}><LocalizedText messageKey="mistakes.fullReview" /> <ArrowUpRight size={15} aria-hidden="true" /></Link>
                    {tags[0] ? <Link className="text-link" href={`/practice?level=${item.level}&tag=${encodeURIComponent(tags[0])}`}><LocalizedText messageKey="mistakes.practiceSkill" /> <ArrowUpRight size={15} aria-hidden="true" /></Link> : null}
                  </footer>
                </article>;
              })}
            </div>
          ) : <div className="empty-state"><p><LocalizedText messageKey="mistakes.empty" /></p><Link className="text-link" href="/exams"><LocalizedText messageKey="dashboard.openLibrary" /> <ArrowUpRight size={15} aria-hidden="true" /></Link><span className="link-separator">·</span><Link className="text-link" href="/bookmarks"><Bookmark size={15} aria-hidden="true" /> <LocalizedText messageKey="dashboard.openBookmarks" /></Link></div>}
        </PaperPanel>
      </ProductSection>
    </ProductPage>
  );
}
