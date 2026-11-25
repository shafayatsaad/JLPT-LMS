"use client";

import Link from "next/link";
import { useLocale } from "@/components/i18n/locale-provider";

export function SiteFooter({ showActionbar = false, compact = false }: { showActionbar?: boolean; compact?: boolean }) {
  const { t } = useLocale();
  return (
    <>
      <footer className={`footer closing footer--dark ground-inverse origami-theme${compact ? " footer--compact" : ""}`} id="closing" aria-labelledby="close-h">
        <div className="wrap">
          {!compact ? <div className="closing__cta close--type">
            <div className="section-head">
              <h2 id="close-h">{t("footer.start")}</h2>
              <p>{t("footer.timed")}</p>
            </div>
            <Link className="btn btn--primary btn--xl" href="/levels/N5">{t("footer.choose")}</Link>
          </div> : null}
          <div className="closing__links">
            {!compact ? <div className="grid">
              <div className="span-6 footer__identity">
                <Link className="nav__logo" href="/">
                  <span className="mark" data-mark="arc" aria-hidden="true" />
                  JLPT practice
                </Link>
                <p className="footer__lede">{t("footer.lede")}</p>
              </div>
              <div className="span-3 start-7 footer__col">
                <h3>{t("footer.practice")}</h3>
                <ul>
                  <li><Link href="/#practice">{t("footer.review")}</Link></li>
                  <li><Link href="/exams">{t("footer.examLibrary")}</Link></li>
                  <li><Link href="/progress">{t("footer.progress")}</Link></li>
                  <li><Link href="/mistakes">{t("footer.mistakes")}</Link></li>
                  <li><Link href="/#levels">{t("footer.levels")}</Link></li>
                  <li><Link href="/pricing">{t("footer.plans")}</Link></li>
                  <li><Link href="/how-it-works">{t("footer.how")}</Link></li>
                  <li><Link href="/faq">{t("footer.questions")}</Link></li>
                  <li><Link href="/auth/register">{t("footer.create")}</Link></li>
                </ul>
              </div>
              <div className="span-3 footer__col">
                <h3>{t("footer.aboutScores")}</h3>
                <ul>
                  <li><Link href="/about">{t("footer.about")}</Link></li>
                  <li><Link href="/contact">{t("footer.contact")}</Link></li>
                  <li><Link href="/settings">{t("footer.settings")}</Link></li>
                  <li><Link href="/legal/privacy">{t("footer.privacy")}</Link></li>
                  <li><Link href="/legal/terms">{t("footer.terms")}</Link></li>
                  <li><Link href="/legal/refunds">{t("footer.refunds")}</Link></li>
                  <li><Link href="/legal/copyright">{t("footer.copyright")}</Link></li>
                  <li><a href="https://www.jlpt.jp/e/guideline/results.html" target="_blank" rel="noreferrer">{t("footer.official")}</a></li>
                </ul>
              </div>
            </div> : null}
            <div className="footer__legal">
              <span>© 2026 JLPT practice</span>
              <span>{t("footer.independent")}</span>
              {compact ? <span><Link href="/legal/privacy">{t("footer.privacy")}</Link> · <Link href="/legal/terms">{t("footer.terms")}</Link></span> : null}
            </div>
          </div>
        </div>
      </footer>
      {showActionbar && <nav className="actionbar origami-theme" aria-label="Quick action">
        <Link className="btn btn--primary" href="/#levels">{t("footer.choose")}</Link>
      </nav>}
    </>
  );
}
