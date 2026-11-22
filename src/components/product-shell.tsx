import Link from "next/link";
import type { ReactNode } from "react";
import { SiteHeader } from "@/components/site-header";

export function OrigamiProductShell({ children }: { children: ReactNode }) {
  return (
    <div className="product-shell origami-theme">
      <SiteHeader />
      <main className="product-main" id="top">{children}</main>
      <footer className="product-footer">
        <div className="product-footer__inner">
          <span>Independent JLPT preparation</span>
          <span>Platform practice scores are not official JLPT scaled scores.</span>
          <Link href="/">Back to home ↑</Link>
        </div>
      </footer>
    </div>
  );
}

export function ExamPreviewShell({ children }: { children: ReactNode }) {
  return (
    <div className="exam-shell">
      <header className="exam-topbar">
        <a className="exam-skip" href="#exam-content">Skip to question workspace</a>
        <Link className="exam-topbar__brand" href="/exams/n5/preview">
          <span aria-hidden="true">JLPT</span>
          <span>N5 interface preview</span>
        </Link>
        <p>Preview only · not a saved exam attempt</p>
        <Link className="exam-topbar__exit" href="/exams/n5/preview">Exit preview</Link>
      </header>
      <main className="exam-main" id="exam-content">{children}</main>
    </div>
  );
}
