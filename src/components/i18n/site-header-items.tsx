"use client";

import Link from "next/link";
import { LanguageSwitch } from "@/components/i18n/language-switch";
import { useLocale } from "@/components/i18n/locale-provider";

export function SiteHeaderItems({ signedIn, hasStaffAccess }: { signedIn: boolean; hasStaffAccess: boolean }) {
  const { t } = useLocale();
  const links = signedIn
    ? [
        { href: "/dashboard", label: t("nav.dashboard") },
        { href: "/account", label: t("nav.account") },
        ...(hasStaffAccess ? [{ href: "/admin", label: t("nav.staff") }] : []),
      ]
    : [
        { href: "/auth/login", label: t("nav.login") },
        { href: "/auth/register", label: t("nav.signup") },
      ];
  return <>
    <nav className="nav__links" aria-label={signedIn ? t("nav.ariaAccount") : t("nav.ariaSignIn")}>
      {links.map((link) => <div className="nav__item" key={link.href}><Link className="nav__link" href={link.href}>{link.label}</Link></div>)}
    </nav>
    <LanguageSwitch compact />
    <button className="nav__toggle" type="button" aria-expanded="false" aria-label={t("nav.ariaMenu")}>
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M2 5h14M2 13h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
    </button>
  </>;
}

export function SiteSkipLink() {
  const { t } = useLocale();
  return <a className="skip-link" href="#top">{t("common.skip")}</a>;
}
