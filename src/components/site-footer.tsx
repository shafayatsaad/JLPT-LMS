export function SiteFooter() {
  return (
    <>
      <footer className="footer closing footer--dark ground-inverse origami-theme" id="closing" aria-labelledby="close-h">
        <div className="wrap">
          <div className="closing__cta close--type">
            <div className="section-head">
              <h2 id="close-h">Start with a JLPT level</h2>
              <p>See the timed sections for N1–N5.</p>
            </div>
            <a className="btn btn--primary btn--xl" href="#levels">Choose a JLPT level</a>
          </div>
          <div className="closing__links">
            <div className="grid">
              <div className="span-6 footer__identity">
                <a className="nav__logo" href="#top">
                  <span className="mark" data-mark="arc" aria-hidden="true" />
                  JLPT practice
                </a>
                <p className="footer__lede">Independent preparation for the Japanese-Language Proficiency Test.</p>
              </div>
              <div className="span-3 start-7 footer__col">
                <h3>Practice</h3>
                <ul>
                  <li><a href="#practice">Question review</a></li>
                  <li><a href="#review">Mistake review</a></li>
                  <li><a href="#levels">Level formats</a></li>
                </ul>
              </div>
              <div className="span-3 footer__col">
                <h3>About the scores</h3>
                <ul>
                  <li><a href="#questions">Scoring questions</a></li>
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
      <nav className="actionbar origami-theme" aria-label="Quick action">
        <a className="btn btn--primary" href="#levels">Choose a JLPT level</a>
      </nav>
    </>
  );
}
