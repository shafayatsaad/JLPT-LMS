import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SiteHeaderItems, SiteSkipLink } from "@/components/i18n/site-header-items";

const STAFF_ROLES = ["content_editor", "reviewer", "payment_reviewer", "support_agent", "admin"];

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

  return (
    <header className="nav nav--split origami-theme">
      <SiteSkipLink />
      <div className="wrap nav__bar">
        <Link className="nav__logo" href="/" aria-label="JLPT practice home">
          <span className="mark" data-mark="arc" aria-hidden="true" />
          JLPT practice
        </Link>
        <SiteHeaderItems signedIn={signedIn} hasStaffAccess={hasStaffAccess} />
      </div>
    </header>
  );
}
