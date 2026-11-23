import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { BookmarkButton } from "@/components/bookmark-button";
import { LocalizedText } from "@/components/i18n/localized-text";
import { PaperPanel, ProductPage, ProductSection } from "@/components/product-page";
import { requireSignedInUser } from "@/lib/auth";

export const metadata = { title: "Saved questions · JLPT practice" };
export const dynamic = "force-dynamic";

type QuestionRow = {
  id: string;
  level: string;
  test_section_code: string;
  prompt: unknown;
};

function promptText(value: unknown): string {
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
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return promptText(object.content ?? object.text ?? "");
  }
  return "";
}

export default async function BookmarksPage() {
  const { supabase, user } = await requireSignedInUser("/bookmarks");
  if (!supabase || !user) {
    return (
      <ProductPage eyebrow="Saved questions" eyebrowKey="bookmarks.eyebrow" title="Your question bookmarks" titleKey="bookmarks.title" description="Keep approved questions here so you can return to them later." descriptionKey="bookmarks.description" className="product-page--dashboard">
        <ProductSection title="Saved for review" titleKey="bookmarks.section"><PaperPanel><p><LocalizedText messageKey="bookmarks.signIn" /></p><Link className="btn btn--primary" href="/auth/login?next=%2Fbookmarks"><LocalizedText messageKey="common.signIn" /></Link></PaperPanel></ProductSection>
      </ProductPage>
    );
  }

  const { data: saved, error } = await supabase
    .from("user_bookmarks")
    .select("question_id,created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  const questionIds = (saved ?? []).map((row) => row.question_id);
  const questionResult = questionIds.length
    ? await supabase.from("questions")
      .select("id,level,test_section_code,prompt")
      .in("id", questionIds)
      .in("status", ["approved", "eligible_for_exam"])
    : { data: [], error: null };
  const byId = new Map(((questionResult.data ?? []) as QuestionRow[]).map((question) => [question.id, question]));
  const questions = questionIds.flatMap((id) => byId.has(id) ? [byId.get(id)!] : []);
  const unavailable = Boolean(error || questionResult.error);

  return (
    <ProductPage eyebrow="Saved questions" eyebrowKey="bookmarks.eyebrow" title="Your question bookmarks" titleKey="bookmarks.title" description="Keep approved questions here so you can return to them later." descriptionKey="bookmarks.description" className="product-page--dashboard">
      <ProductSection title="Saved for review" titleKey="bookmarks.section" className="product-section--tint">
        <PaperPanel className="data-panel">
          {unavailable ? <p className="inline-notice"><LocalizedText messageKey="bookmarks.unavailable" /></p> : questions.length ? (
            <div className="bookmark-list">{questions.map((question) => (
              <article className="bookmark-card origami-answer-card" key={question.id}>
                <p className="product-small-label"><LocalizedText messageKey="bookmarks.level" values={{ level: question.level }} /> · <LocalizedText messageKey="bookmarks.sectionCode" values={{ section: question.test_section_code }} /></p>
                <p className="bookmark-card__prompt" lang="ja">{promptText(question.prompt) || question.id}</p>
                <BookmarkButton questionId={question.id} initiallyBookmarked refreshOnChange />
              </article>
            ))}</div>
          ) : <div className="empty-state"><p><LocalizedText messageKey="bookmarks.empty" /></p><Link className="text-link" href="/exams"><LocalizedText messageKey="dashboard.openLibrary" /> <ArrowUpRight size={15} aria-hidden="true" /></Link></div>}
        </PaperPanel>
      </ProductSection>
    </ProductPage>
  );
}
