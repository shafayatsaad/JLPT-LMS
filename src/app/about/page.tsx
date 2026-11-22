import Link from "next/link";
import { ArrowUpRight, BookOpenCheck, ShieldCheck, Target } from "lucide-react";
import { ProductPage, ProductSection, PaperPanel } from "@/components/product-page";

export const metadata = {
  title: "About JLPT practice · Independent mock exams",
  description: "How JLPT practice prepares original mock questions, reviews answers, and reports raw results.",
};

export default function AboutPage() {
  return (
    <ProductPage eyebrow="About the platform" title="Independent JLPT preparation" description="A practice platform for learners preparing for JLPT N1 through N5. Questions and explanations are prepared and reviewed before they are used." className="product-page--editorial">
      <ProductSection title="How the practice is built" className="product-section--tint">
        <div className="paper-grid paper-grid--3">
          <PaperPanel className="feature-panel"><BookOpenCheck aria-hidden="true" /><h3>Original questions</h3><p>Practice items are written for this platform. The plan excludes copied official past questions.</p></PaperPanel>
          <PaperPanel className="feature-panel"><ShieldCheck aria-hidden="true" /><h3>Review before use</h3><p>Questions move through validation and human review before they can enter a published form.</p></PaperPanel>
          <PaperPanel className="feature-panel"><Target aria-hidden="true" /><h3>Raw performance</h3><p>Results describe your answers. They do not estimate or claim an official JLPT scaled score.</p></PaperPanel>
        </div>
      </ProductSection>
      <ProductSection title="What the platform does not claim">
        <PaperPanel className="statement-panel"><p>The JLPT organizers do not operate or endorse this platform. Mock exam results are practice information, not an official certificate, scaled score, or pass prediction.</p><Link className="text-link" href="/#levels">Explore JLPT levels <ArrowUpRight size={15} aria-hidden="true" /></Link></PaperPanel>
      </ProductSection>
    </ProductPage>
  );
}
