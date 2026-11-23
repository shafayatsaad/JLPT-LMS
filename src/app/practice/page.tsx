import Link from "next/link";
import { LocalizedText } from "@/components/i18n/localized-text";
import { PaperPanel, ProductPage, ProductSection } from "@/components/product-page";
import { TargetedPracticeSetup, type PracticeHistoryItem, type PracticeTagOption } from "@/components/targeted-practice-setup";
import { requireSignedInUser } from "@/lib/auth";
import type { JlptLevel } from "@/lib/jlpt-format";

export const metadata = { title: "Targeted practice · JLPT practice" };
export const dynamic = "force-dynamic";

export default async function TargetedPracticePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const queryLevel = Array.isArray(query.level) ? query.level[0] : query.level;
  const queryTag = Array.isArray(query.tag) ? query.tag[0] : query.tag;
  const { supabase, user } = await requireSignedInUser("/practice");
  if (!supabase || !user) {
    return (
      <ProductPage eyebrow="Targeted practice" eyebrowKey="practice.eyebrow" title="Practice a skill" titleKey="practice.title" description="Choose a JLPT level and skill to start a short set from reviewed questions." descriptionKey="practice.description" className="product-page--dashboard">
        <ProductSection title="Practice access" titleKey="practice.setupTitle"><PaperPanel><p><LocalizedText messageKey="practice.login" /></p><Link className="btn btn--primary" href="/auth/login?next=%2Fpractice"><LocalizedText messageKey="common.signIn" /></Link></PaperPanel></ProductSection>
      </ProductPage>
    );
  }

  const [{ data: profile }, tagsResult, historyResult] = await Promise.all([
    supabase.from("profiles").select("target_level,preferred_timezone").eq("user_id", user.id).maybeSingle(),
    supabase.rpc("list_targeted_practice_tags"),
    supabase.rpc("list_my_targeted_practice_sessions"),
  ]);
  const availableTags = (tagsResult.data ?? []) as PracticeTagOption[];
  const history = (historyResult.data ?? []) as PracticeHistoryItem[];
  const dataError = tagsResult.error ?? historyResult.error;
  const initialLevel = ["N1", "N2", "N3", "N4", "N5"].includes(profile?.target_level ?? "")
    ? profile!.target_level as JlptLevel
    : "N5";
  const selectedLevel = ["N1", "N2", "N3", "N4", "N5"].includes(queryLevel ?? "")
    ? queryLevel as JlptLevel
    : initialLevel;

  return (
    <ProductPage eyebrow="Targeted practice" eyebrowKey="practice.eyebrow" title="Practice a skill" titleKey="practice.title" description="Choose a JLPT level and skill to start a short set from reviewed questions." descriptionKey="practice.description" className="product-page--dashboard">
      <ProductSection title="Choose a level and skill" titleKey="practice.setupTitle" className="product-section--tint">
        <PaperPanel className="data-panel">
          {dataError ? <p className="inline-notice"><LocalizedText messageKey="practice.migration" /></p> : <TargetedPracticeSetup tags={availableTags} history={history} initialLevel={selectedLevel} initialTagSlug={queryTag} timeZone={profile?.preferred_timezone ?? "Asia/Dhaka"} />}
        </PaperPanel>
      </ProductSection>
    </ProductPage>
  );
}
