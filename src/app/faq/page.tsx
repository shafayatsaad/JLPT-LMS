import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { PaperPanel, ProductPage, ProductSection } from "@/components/product-page";

export const metadata = {
  title: "Frequently asked questions · JLPT practice",
  description: "Answers about account access, practice previews, scores, payments and the independent JLPT practice platform.",
};

const questions = [
  ["Is this an official JLPT website?", "No. This is an independent practice platform and is not operated, approved or endorsed by the JLPT organizers."],
  ["Are full mock exams available now?", "The N5 preview demonstrates the interface only. The app now includes a separate server-timed attempt flow, but learners can use it only after reviewed forms are published in Supabase and the required migrations are applied."],
  ["Are the practice questions official past questions?", "The platform is intended to use original or expressly licensed content. Official JLPT questions, prep-book content and recordings must not be copied without permission."],
  ["What do mock results mean?", "Practice results are raw performance information. They are not official JLPT scaled scores, pass predictions or certificates."],
  ["How can I create an account?", "Email and password registration with email confirmation, and Google sign-in, are available in the current testing setup. Phone registration and SMS recovery are hidden until an SMS provider is configured."],
  ["Can I buy Premium or pay with bKash?", "No checkout is open yet. The plan durations and access matrix are proposed previews; prices and verified bKash instructions have not been approved."],
  ["How do I contact support?", "Sign in and open a private support request. This keeps account details and replies inside the learner support inbox."],
] as const;

export default function FaqPage() {
  return (
    <ProductPage eyebrow="Questions" title="Answers before you begin" description="Current account and practice details for learners testing the platform." className="product-page--editorial">
      <ProductSection title="Common questions" className="product-section--tint">
        <div className="faq-page-list">
          {questions.map(([question, answer], index) => (
            <PaperPanel className="faq-page-item" key={question}>
              <span className="product-small-label">{String(index + 1).padStart(2, "0")}</span>
              <h3>{question}</h3>
              <p>{answer}</p>
            </PaperPanel>
          ))}
        </div>
      </ProductSection>
      <ProductSection title="Need help with your account?">
        <PaperPanel className="statement-panel"><p>Open a private support request after signing in. For level formats, review the N1–N5 section guide.</p><div className="product-cta-row"><Link className="btn btn--primary" href="/support">Go to support <ArrowUpRight size={15} aria-hidden="true" /></Link><Link className="text-link" href="/#levels">Browse level formats <ArrowUpRight size={15} aria-hidden="true" /></Link></div></PaperPanel>
      </ProductSection>
    </ProductPage>
  );
}
