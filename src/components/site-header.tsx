export function SiteHeader() {
  return (
    <header className="nav nav--split origami-theme">
      <div className="wrap nav__bar">
        <a className="skip-link" href="#top">Skip to content</a>
        <a className="nav__logo" href="#top" aria-label="JLPT practice home">
          <span className="mark" data-mark="arc" aria-hidden="true" />
          JLPT practice
        </a>
        <nav className="nav__links" aria-label="Main navigation">
          <div className="nav__item"><a className="nav__link" href="#practice">Question review</a></div>
          <div className="nav__item"><a className="nav__link" href="#review">Review steps</a></div>
          <div className="nav__item"><a className="nav__link" href="#levels">JLPT section timings</a></div>
          <div className="nav__item"><a className="nav__link" href="#questions">Question checks</a></div>
        </nav>
        <button className="nav__toggle" type="button" aria-expanded="false" aria-label="Menu">
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path d="M2 5h14M2 13h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </header>
  );
}
