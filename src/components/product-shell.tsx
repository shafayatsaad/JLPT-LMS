import Link from "next/link";
import type { ReactNode } from "react";
import { SiteHeader } from "@/components/site-header";
import { LanguageSwitch } from "@/components/i18n/language-switch";
import { LocalizedText } from "@/components/i18n/localized-text";

export function OrigamiProductShell({ children }: { children: ReactNode }) {
  return (
    <div className="product-shell origami-theme">
      <SiteHeader />
      <main className="product-main" id="top" tabIndex={-1}>{children}</main>
      <footer className="product-footer">
        <div className="product-footer__inner">
          <span><LocalizedText messageKey="productShell.footer.brand" /></span>
          <span><LocalizedText messageKey="productShell.footer.disclaimer" /></span>
          <Link href="/"><LocalizedText messageKey="productShell.footer.home" /> ↑</Link>
        </div>
      </footer>
    </div>
  );
}

export function ExamPreviewShell({ children }: { children: ReactNode }) {
  return (
    <div className="exam-shell">
      <header className="exam-topbar">
        <a className="exam-skip" href="#exam-content"><LocalizedText messageKey="common.skip" /></a>
        <Link className="exam-topbar__brand" href="/exams/n5/preview">
          <span aria-hidden="true">JLPT</span>
          <span>N5 · <LocalizedText messageKey="preview.examInterface" /></span>
        </Link>
        <p><LocalizedText messageKey="preview.toolbarStatus" /></p>
        <LanguageSwitch compact />
        <Link className="exam-topbar__exit" href="/exams/n5/preview"><LocalizedText messageKey="preview.backOverview" /></Link>
      </header>
      <main className="exam-main" id="exam-content" tabIndex={-1}>{children}</main>
    </div>
  );
}
