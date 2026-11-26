"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import { LanguageSwitch } from "@/components/i18n/language-switch";
import { useLocale } from "@/components/i18n/locale-provider";
import { SignOutButton } from "@/components/sign-out-button";

export function SiteHeaderItems({ signedIn, hasStaffAccess }: { signedIn: boolean; hasStaffAccess: boolean }) {
  const { t } = useLocale();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const links = signedIn
    ? hasStaffAccess
      ? [
          { href: "/admin", label: t("nav.staffWorkspace") },
          { href: "/dashboard?view=learner", label: t("nav.learnerView") },
          { href: "/account", label: t("nav.profile") },
        ]
      : [
          { href: "/dashboard", label: t("nav.dashboard") },
          { href: "/exams", label: t("nav.mockExams") },
          { href: "/practice", label: t("nav.practice") },
          { href: "/progress", label: t("nav.results") },
          { href: "/leaderboard", label: t("nav.leaderboard") },
          { href: "/account", label: t("nav.profile") },
        ]
    : [
        { href: "/auth/login", label: t("nav.login") },
        { href: "/auth/register", label: t("nav.signup") },
      ];
  function isCurrent(href: string) {
    const route = href.split("?", 1)[0];
    return pathname === route || (route !== "/" && pathname.startsWith(`${route}/`));
  }
  useEffect(() => {
    const header = toggleRef.current?.closest("header.nav");
    header?.classList.toggle("is-open", menuOpen);
    document.body.classList.toggle("nav-locked", menuOpen);
    return () => {
      header?.classList.remove("is-open");
      document.body.classList.remove("nav-locked");
    };
  }, [menuOpen]);
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        toggleRef.current?.focus();
      }
    };
    const closeOnDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) setMenuOpen(false);
    };
    const desktop = window.matchMedia("(min-width: 1024px)");
    document.addEventListener("keydown", closeOnEscape);
    desktop.addEventListener("change", closeOnDesktop);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      desktop.removeEventListener("change", closeOnDesktop);
    };
  }, []);
  function closeMobileMenu() { setMenuOpen(false); }
  return <>
    <nav className="nav__links" aria-label={signedIn ? t("nav.ariaAccount") : t("nav.ariaSignIn")}>
      {links.map((link) => <div className="nav__item" key={link.href}><Link className="nav__link" href={link.href} prefetch={link.href === "/dashboard?view=learner" ? false : undefined} aria-current={isCurrent(link.href) ? "page" : undefined} onClick={closeMobileMenu}>{link.label}</Link></div>)}
      {signedIn ? <div className="nav__item nav__item--notification"><Link className="nav__link nav__notification-link" href="/notifications" aria-label={t("nav.notifications")} aria-current={isCurrent("/notifications") ? "page" : undefined} onClick={closeMobileMenu}><Bell size={18} aria-hidden="true" /><span className="sr-only">{t("nav.notifications")}</span></Link></div> : null}
      {signedIn ? <div className="nav__item nav__item--signout"><SignOutButton className="nav__link nav__signout" onSignedOut={closeMobileMenu} /></div> : null}
    </nav>
    <LanguageSwitch compact />
    <button ref={toggleRef} className="nav__toggle" type="button" data-react-controlled="true" aria-expanded={menuOpen} aria-label={t(menuOpen ? "nav.ariaCloseMenu" : "nav.ariaMenu")} onClick={() => setMenuOpen((open) => !open)}>
      {menuOpen
        ? <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
        : <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M2 5h14M2 13h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>}
    </button>
  </>;
}

export function SiteSkipLink() {
  const { t } = useLocale();
  return <a className="skip-link" href="#top">{t("common.skip")}</a>;
}
