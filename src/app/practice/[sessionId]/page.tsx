import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { LocalizedText } from "@/components/i18n/localized-text";
import { TargetedPracticeSession, type TargetedPracticePayload } from "@/components/targeted-practice-session";
import { PaperPanel, ProductPage, ProductSection } from "@/components/product-page";
import { requireSignedInUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function TargetedPracticeSessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const { supabase, user } = await requireSignedInUser(`/practice/${sessionId}`);
  if (!supabase || !user) {
    return <ProductPage eyebrow="Targeted practice" eyebrowKey="practice.eyebrow" title="Practice a skill" titleKey="practice.title" description="Sign in to continue a saved practice set." descriptionKey="practice.login" className="product-page--dashboard"><ProductSection title="Practice access" titleKey="practice.setupTitle"><PaperPanel><Link className="btn btn--primary" href={`/auth/login?next=${encodeURIComponent(`/practice/${sessionId}`)}`}><LocalizedText messageKey="common.signIn" /></Link></PaperPanel></ProductSection></ProductPage>;
  }

  const { data, error } = await supabase.rpc("get_targeted_practice_session", { p_session_id: sessionId });
  if (!data && !error) notFound();
  const payload = data as TargetedPracticePayload | null;
  if (payload?.session.status === "submitted") redirect(`/practice/${sessionId}/review`);

  return (
    <ProductPage eyebrow="Targeted practice" eyebrowKey="practice.eyebrow" title="Practice a skill" titleKey="practice.title" description="Your choices are saved to this account. Feedback and approved explanations appear after submission." descriptionKey="practice.sessionDescription" className="product-page--dashboard">
      <ProductSection title="Practice set" titleKey="practice.sessionSection" className="product-section--tint">
        <PaperPanel className="data-panel">
          {error || !payload ? <p className="inline-notice"><LocalizedText messageKey="practice.migration" /></p> : <TargetedPracticeSession initialPayload={payload} />}
        </PaperPanel>
      </ProductSection>
    </ProductPage>
  );
}
