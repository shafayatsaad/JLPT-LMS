import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { PaperPanel, ProductPage, ProductSection } from "@/components/product-page";
import { SignOutButton } from "@/components/sign-out-button";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isLocalDemoEnvironment } from "@/lib/local-demo";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Staff sign in · JLPT practice",
  robots: { index: false, follow: false },
};

export default async function AdminSignInPage() {
  const showLocalDemoAccounts = isLocalDemoEnvironment();
  const supabase = await createSupabaseServerClient();
  const { data: { user } = { user: null } } = supabase
    ? await supabase.auth.getUser()
    : { data: { user: null } };

  if (user && supabase) {
    const { data: staffFromRpc, error: rpcError } = await supabase.rpc("is_current_user_staff");
    let hasStaffAccess = !rpcError && staffFromRpc === true;
    let error = rpcError;
    if (rpcError) {
      const { data: roles, error: queryError } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      error = queryError;
      hasStaffAccess = !queryError && roles?.some((row) => ["content_editor", "reviewer", "payment_reviewer", "support_agent", "admin"].includes(row.role)) === true;
    }

    if (hasStaffAccess) {
      return (
        <ProductPage eyebrow="Staff workspace" title="You’re signed in" description="This account has an authorized staff role. Open the staff workspace to continue." className="product-page--auth">
          <ProductSection title="Staff access">
            <PaperPanel className="auth-panel">
              <p className="security-row">Signed in as <strong>{user.email ?? user.phone ?? "your account"}</strong></p>
              <div className="account-strip__actions">
                <Link className="btn btn--primary" href="/admin">Open staff workspace</Link>
                <SignOutButton />
              </div>
            </PaperPanel>
          </ProductSection>
        </ProductPage>
      );
    }

    return (
      <ProductPage eyebrow="Staff workspace" title={error ? "Staff access could not be checked" : "This account has no staff role"} description={error ? "Apply the Supabase migrations before checking staff access." : "Staff access is assigned individually by a project owner. Student accounts cannot open the staff workspace."} className="product-page--auth">
        <ProductSection title="Account access">
          <PaperPanel className="auth-panel">
            <p>Signed in as <strong>{user.email ?? user.phone ?? "your account"}</strong>.</p>
            <div className="account-strip__actions">
              <Link className="btn btn--secondary" href="/dashboard">Return to learner dashboard</Link>
              <SignOutButton />
            </div>
          </PaperPanel>
        </ProductSection>
      </ProductPage>
    );
  }

  return (
    <ProductPage eyebrow="Private staff entry" title="Sign in to staff workspace" description="Use your individual account. Staff permissions are checked after sign in; this entry does not grant administrator access." className="product-page--auth">
      <ProductSection title="Staff account access">
        <PaperPanel className="auth-panel">
          <AuthForm mode="login" defaultNext="/admin" />
          <p className="field-hint">If your account is not assigned a staff role, you will return to the learner area.</p>
          {showLocalDemoAccounts ? <p className="auth-switch"><Link href="/dev/test-accounts">View local test profiles</Link></p> : null}
        </PaperPanel>
      </ProductSection>
    </ProductPage>
  );
}
