import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function requireSignedInUser(nextPath = "/dashboard") {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { supabase: null, user: null };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/auth/login?next=${encodeURIComponent(nextPath)}`);
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
  return { supabase, user, role };
}
