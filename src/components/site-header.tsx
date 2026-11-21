export function SiteHeader() {
  return (
    <header className="nav nav--split">
      <div className="wrap nav__bar">
        <a className="nav__logo" href="#top" aria-label="JLPT practice home">
          <span className="mark" data-mark="arc" aria-hidden="true" />
          JLPT practice
        </a>
        <nav className="nav__links" aria-label="Main navigation">
          <div className="nav__item"><a className="nav__link" href="#practice">Practice</a></div>
          <div className="nav__item"><a className="nav__link" href="#review">Review</a></div>
          <div className="nav__item"><a className="nav__link" href="#levels">Levels</a></div>
          <div className="nav__item"><a className="nav__link" href="#questions">Questions</a></div>
        </nav>
        <div className="nav__actions">
          <a className="btn btn--primary" href="#levels">Choose a JLPT level</a>
        </div>
        <button className="nav__toggle" type="button" aria-expanded="false" aria-label="Menu">
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path d="M2 5h14M2 13h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </header>
  );
}
