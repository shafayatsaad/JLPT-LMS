import { redirect } from "next/navigation";
import { AdminMfaChallenge } from "@/components/admin/admin-mfa-challenge";
import { PaperPanel, ProductPage, ProductSection } from "@/components/product-page";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Staff verification · JLPT Practice",
  robots: { index: false, follow: false },
};

const staffRoles = ["content_editor", "reviewer", "payment_reviewer", "support_agent", "admin"];

function safeAdminPath(value: string | string[] | undefined) {
  if (typeof value !== "string") return "/admin";
  try {
    const parsed = new URL(value, "https://local.invalid");
    if (parsed.origin !== "https://local.invalid") return "/admin";
    if (parsed.pathname !== "/admin" && !parsed.pathname.startsWith("/admin/")) return "/admin";
    if (parsed.pathname === "/admin/mfa" || parsed.pathname === "/admin/sign-in") return "/admin";
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return "/admin";
  }
}

export default async function AdminMfaPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const params = await searchParams;
  const nextPath = safeAdminPath(params.next);
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return <ProductPage eyebrow="Staff workspace" title="Staff verification" description="Connect Supabase to continue to the private staff workspace." className="product-page--auth"><ProductSection title="Supabase setup required"><PaperPanel><p>Staff sign-in and authenticator verification need the Supabase project configured for this environment.</p></PaperPanel></ProductSection></ProductPage>;
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/auth/login?next=${encodeURIComponent(`/admin/mfa?next=${nextPath}`)}`);

  const { data: isStaff, error: roleError } = await supabase.rpc("is_current_user_staff");
  let hasStaffAccess = !roleError && isStaff === true;
  if (roleError) {
    const { data: roleRows, error: fallbackError } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    hasStaffAccess = !fallbackError && Boolean(roleRows?.some((row) => staffRoles.includes(row.role)));
  }
  if (!hasStaffAccess) {
    redirect("/dashboard?notice=staff-access-required");
  }

  const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance?.currentLevel === "aal2") redirect(nextPath);

  return (
    <ProductPage eyebrow="Staff workspace · protected" title="Verify staff access" description="Use an authenticator app to complete the second sign-in step before opening staff tools." className="product-page--auth">
      <ProductSection title="Authenticator verification" className="product-section--tint">
        <PaperPanel className="auth-panel">
          <AdminMfaChallenge nextPath={nextPath} />
        </PaperPanel>
      </ProductSection>
    </ProductPage>
  );
}
