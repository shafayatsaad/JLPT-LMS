import { notFound } from "next/navigation";
import { ProductPage, ProductSection, PaperPanel } from "@/components/product-page";
import { LocalizedText } from "@/components/i18n/localized-text";
import type { MessageKey } from "@/lib/i18n";

const policyPages: Record<string, { label: string; titleKey: MessageKey; descriptionKey: MessageKey; topics: MessageKey[] }> = {
  privacy: {
    label: "Privacy notice",
    titleKey: "legal.privacy.title",
    descriptionKey: "legal.privacy.description",
    topics: ["legal.privacy.topic.information", "legal.privacy.topic.retention", "legal.privacy.topic.hosting", "legal.privacy.topic.contact"],
  },
  terms: {
    label: "Terms of use",
    titleKey: "legal.terms.title",
    descriptionKey: "legal.terms.description",
    topics: ["legal.terms.topic.account", "legal.terms.topic.content", "legal.terms.topic.availability", "legal.terms.topic.contact"],
  },
  refunds: {
    label: "Refunds and cancellation",
    titleKey: "legal.refunds.title",
    descriptionKey: "legal.refunds.description",
    topics: ["legal.refunds.topic.cases", "legal.refunds.topic.steps", "legal.refunds.topic.timeline", "legal.refunds.topic.access"],
  },
  copyright: {
    label: "Copyright notice",
    titleKey: "legal.copyright.title",
    descriptionKey: "legal.copyright.description",
    topics: ["legal.copyright.topic.original", "legal.copyright.topic.records", "legal.copyright.topic.reporting", "legal.copyright.topic.independent"],
  },
};

export async function generateMetadata({ params }: { params: Promise<{ policy: string }> }) {
  const { policy } = await params;
  const item = policyPages[policy];
  return { title: item ? `${item.label} · JLPT practice` : "Policy · JLPT practice" };
}

export default async function LegalPage({ params }: { params: Promise<{ policy: string }> }) {
  const { policy } = await params;
  const item = policyPages[policy];
  if (!item) notFound();

  return (
    <ProductPage eyebrow="Draft policy" eyebrowKey="legal.eyebrow" title={item.label} titleKey={item.titleKey} description={item.label} descriptionKey={item.descriptionKey} className="product-page--editorial">
      <ProductSection title="Review needed before publication" titleKey="legal.section.review" className="product-section--tint">
        <PaperPanel className="statement-panel policy-draft">
          <p className="draft-stamp"><LocalizedText messageKey="legal.notApproved" /></p>
          <p><LocalizedText messageKey="legal.checklist" /></p>
          <ul>{item.topics.map((topicKey) => <li key={topicKey}><LocalizedText messageKey={topicKey} /></li>)}</ul>
        </PaperPanel>
      </ProductSection>
    </ProductPage>
  );
}
