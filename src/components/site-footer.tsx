import Link from "next/link";

export function SiteFooter({ showActionbar = false }: { showActionbar?: boolean }) {
  return (
    <>
      <footer className="footer closing footer--dark ground-inverse origami-theme" id="closing" aria-labelledby="close-h">
        <div className="wrap">
          <div className="closing__cta close--type">
            <div className="section-head">
              <h2 id="close-h">Start with a JLPT level</h2>
              <p>See the timed sections for N1–N5.</p>
            </div>
            <Link className="btn btn--primary btn--xl" href="/levels/N5">Choose a JLPT level</Link>
          </div>
          <div className="closing__links">
            <div className="grid">
              <div className="span-6 footer__identity">
                <Link className="nav__logo" href="/">
                  <span className="mark" data-mark="arc" aria-hidden="true" />
                  JLPT practice
                </Link>
                <p className="footer__lede">Independent preparation for the Japanese-Language Proficiency Test.</p>
              </div>
              <div className="span-3 start-7 footer__col">
                <h3>Practice</h3>
                <ul>
                  <li><Link href="/#practice">Question review</Link></li>
                  <li><Link href="/mistakes">Mistake review</Link></li>
                  <li><Link href="/#levels">Level formats</Link></li>
                  <li><Link href="/pricing">Plans and access</Link></li>
                  <li><Link href="/auth/register">Create account</Link></li>
                </ul>
              </div>
              <div className="span-3 footer__col">
                <h3>About the scores</h3>
                <ul>
                  <li><Link href="/about">About the platform</Link></li>
                  <li><Link href="/legal/privacy">Privacy draft</Link></li>
                  <li><Link href="/legal/terms">Terms draft</Link></li>
                  <li><Link href="/legal/refunds">Refund draft</Link></li>
                  <li><Link href="/legal/copyright">Copyright draft</Link></li>
                  <li><a href="https://www.jlpt.jp/e/guideline/results.html" target="_blank" rel="noreferrer">Official JLPT scoring</a></li>
                </ul>
              </div>
            </div>
            <div className="footer__legal">
              <span>© 2026 JLPT practice</span>
              <span>Independent platform. No JLPT endorsement.</span>
            </div>
          </div>
        </div>
      </footer>
      {showActionbar && <nav className="actionbar origami-theme" aria-label="Quick action">
        <Link className="btn btn--primary" href="/#levels">Choose a JLPT level</Link>
      </nav>}
    </>
  );
}
