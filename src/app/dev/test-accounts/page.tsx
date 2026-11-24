import Link from "next/link";
import { notFound } from "next/navigation";
import { PaperPanel, ProductPage, ProductSection } from "@/components/product-page";
import { isLocalDemoEnvironment } from "@/lib/local-demo";

export const dynamic = "force-dynamic";
export const metadata = { title: "Local test accounts · JLPT practice", robots: { index: false, follow: false } };

export default function LocalTestAccountsPage() {
  if (!isLocalDemoEnvironment()) notFound();

  return (
    <ProductPage eyebrow="Local development only" title="Test learner and staff profiles" description="These seeded accounts exist only in your local Supabase database. The demo command never writes users to your hosted Supabase project." className="product-page--auth">
      <ProductSection title="Learner profile">
        <PaperPanel className="auth-panel">
          <p><strong>Email:</strong> <code className="local-demo-credential">student@n5.test</code></p>
          <p><strong>Password:</strong> <code className="local-demo-credential">N5learn26</code></p>
          <p>This profile has the student role, verified local demo phone, and N5 as its target level.</p>
          <Link className="btn btn--primary" href="/auth/login">Sign in as learner</Link>
        </PaperPanel>
      </ProductSection>
      <ProductSection title="Administrator profile">
        <PaperPanel className="auth-panel">
          <p><strong>Email:</strong> <code className="local-demo-credential">admin@n5.test</code></p>
          <p><strong>Password:</strong> <code className="local-demo-credential">N5admin26</code></p>
          <p>On first use, enroll an authenticator app at <Link href="/admin/mfa">the staff MFA page</Link>. Staff pages remain protected by MFA.</p>
          <Link className="btn btn--primary" href="/admin/sign-in">Open staff sign in</Link>
          <nav className="demo-workflow-links" aria-label="Administrator demo workflows">
            <Link href="/admin">Admin overview</Link>
            <Link href="/admin/payments?status=pending">Review fake payment</Link>
            <Link href="/admin/support">Reply to sample support ticket</Link>
            <Link href="/admin/questions">Manage sample questions</Link>
            <Link href="/admin/questions/new">Bulk-import questions and media</Link>
            <Link href="/admin/sources">Upload past-paper PDFs and audio</Link>
            <Link href="/admin/exam-forms">Review sample exam form</Link>
            <Link href="/admin/users">Manage test accounts</Link>
            <Link href="/admin/settings/integrations">Simulate payment sheet sync</Link>
          </nav>
        </PaperPanel>
      </ProductSection>
      <ProductSection title="Student demo workflows">
        <PaperPanel className="auth-panel">
          <p>Sign in as the learner to try the seeded mock, progress, saved questions and support. Submit the fake checkout once, then use the administrator profile to review and approve that request.</p>
          <nav className="demo-workflow-links" aria-label="Student demo workflows">
            <Link href="/dashboard">Dashboard and shortcuts</Link>
            <Link href="/exams">Start the six-question mock</Link>
            <Link href="/review/47000000-0000-4000-8000-000000000001">Review a completed attempt</Link>
            <Link href="/progress">Progress report</Link>
            <Link href="/mistakes">Mistake notebook</Link>
            <Link href="/bookmarks">Saved question</Link>
            <Link href="/upgrade/bkash">Fake payment checkout</Link>
            <Link href="/payments">Payment history</Link>
            <Link href="/support">Sample support ticket</Link>
            <Link href="/notifications">Demo notification</Link>
          </nav>
        </PaperPanel>
      </ProductSection>
      <ProductSection title="Paper exam preview">
        <PaperPanel className="auth-panel">
          <p>The learner preview demonstrates the booklet and answer sheet. After signing in with the staff profile and enrolling MFA, the same renderer is available from the admin workspace.</p>
          <Link className="text-link" href="/exams/n5/preview/session">Open learner sample</Link>
        </PaperPanel>
      </ProductSection>
    </ProductPage>
  );
}
