import { notFound } from "next/navigation";
import { ProductPage, ProductSection, PaperPanel } from "@/components/product-page";

const policyPages: Record<string, { label: string; title: string; description: string; topics: string[] }> = {
  privacy: {
    label: "Privacy notice",
    title: "Privacy notice draft",
    description: "The privacy policy text needs owner and legal review before it can be published as a policy.",
    topics: ["Information collected and why", "Retention and deletion periods", "Supabase hosting and account security", "Contact for privacy requests"],
  },
  terms: {
    label: "Terms of use",
    title: "Terms draft",
    description: "Terms of use need owner and legal review before they can govern account or exam access.",
    topics: ["Account responsibilities", "Practice content and permitted use", "Service availability and limitations", "Contact and dispute process"],
  },
  refunds: {
    label: "Refunds and cancellation",
    title: "Refund and cancellation policy draft",
    description: "No payment plan is active. Refund and cancellation terms require a confirmed payment flow and approval.",
    topics: ["Eligible payment cases", "Request and review steps", "Processing timeline", "Cancellation and access end dates"],
  },
  copyright: {
    label: "Copyright notice",
    title: "Copyright and content notice draft",
    description: "This platform is independent. Practice content is intended to be original and must not reproduce JLPT materials without permission.",
    topics: ["Original practice questions and explanations", "Attribution and permission records", "Reporting a rights concern", "Independent platform statement"],
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
    <ProductPage eyebrow={`Draft · ${item.label}`} title={item.title} description={item.description} className="product-page--editorial">
      <ProductSection title="Review needed before publication" className="product-section--tint">
        <PaperPanel className="statement-panel policy-draft">
          <p className="draft-stamp">NOT APPROVED FOR PUBLICATION</p>
          <p>The topics below are a drafting checklist, not legal policy language. Replace them with approved text before launch.</p>
          <ul>{item.topics.map((topic) => <li key={topic}>{topic}</li>)}</ul>
        </PaperPanel>
      </ProductSection>
    </ProductPage>
  );
}
