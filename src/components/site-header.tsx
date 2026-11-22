import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const STAFF_ROLES = ["content_editor", "reviewer", "payment_reviewer", "admin"];

export async function SiteHeader() {
  let signedIn = false;
  let hasStaffAccess = false;

  try {
    const supabase = await createSupabaseServerClient();
    if (supabase) {
      const { data: { user } } = await supabase.auth.getUser();
      signedIn = Boolean(user);
      if (user) {
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);
        hasStaffAccess = Boolean(roles?.some((row) => STAFF_ROLES.includes(row.role)));
      }
    }
  } catch {
    // Keep the public navigation usable if Supabase is temporarily unavailable.
  }

  const links = signedIn
    ? [
        { href: "/dashboard", label: "Dashboard" },
        { href: "/account", label: "Account" },
        ...(hasStaffAccess ? [{ href: "/admin", label: "Staff" }] : []),
      ]
    : [
        { href: "/auth/login", label: "Log in" },
        { href: "/auth/register", label: "Sign up" },
      ];

  return (
    <header className="nav nav--split origami-theme">
      <div className="wrap nav__bar">
        <a className="skip-link" href="#top">Skip to content</a>
        <Link className="nav__logo" href="/" aria-label="JLPT practice home">
          <span className="mark" data-mark="arc" aria-hidden="true" />
          JLPT practice
        </Link>
        <nav className="nav__links" aria-label={signedIn ? "Account navigation" : "Sign-in navigation"}>
          {links.map((link) => (
            <div className="nav__item" key={link.href}>
              <Link className="nav__link" href={link.href}>{link.label}</Link>
            </div>
          ))}
        </nav>
        <button className="nav__toggle" type="button" aria-expanded="false" aria-label="Open navigation menu">
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path d="M2 5h14M2 13h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </header>
  );
}
