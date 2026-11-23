import { redirect } from "next/navigation";
import { resolveStepUpAccess } from "@/lib/auth-step-up";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function hasStaffMfaAssurance(supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>) {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  return !error && data?.currentLevel === "aal2";
}

export async function requireStaffMfa(supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>, nextPath: string) {
  if (!(await hasStaffMfaAssurance(supabase))) {
    redirect(`/admin/mfa?next=${encodeURIComponent(nextPath)}`);
  }
}

export async function requireSignedInUser(nextPath = "/dashboard") {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { supabase: null, user: null };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/auth/login?next=${encodeURIComponent(nextPath)}`);

  const stepUp = await resolveStepUpAccess(supabase);
  if (stepUp === "required") redirect(`/auth/continue?next=${encodeURIComponent(nextPath)}`);
  if (stepUp === "unavailable") redirect(`/auth/step-up-unavailable?next=${encodeURIComponent(nextPath)}`);
  return { supabase, user };
}

export async function requireStaff(roles: string[], nextPath: string) {
  const { supabase, user } = await requireSignedInUser(nextPath);
  if (!supabase || !user) return { supabase: null, user: null, role: null };

  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);
  const role = data?.find((row) => roles.includes(row.role))?.role ?? null;

  if (!role) redirect("/dashboard?notice=staff-access-required");
  await requireStaffMfa(supabase, nextPath);
  return { supabase, user, role };
}
