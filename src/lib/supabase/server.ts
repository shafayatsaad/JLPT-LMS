import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabasePublicConfig } from "@/lib/supabase/config";
import { getSupabaseAuthCookieName, getSupabaseServerUrl } from "@/lib/supabase/server-config";

export async function createSupabaseServerClient() {
  const config = getSupabasePublicConfig();
  if (!config) return null;

  const cookieStore = await cookies();
  return createServerClient(getSupabaseServerUrl(config.url), config.publishableKey, {
    cookieOptions: { name: getSupabaseAuthCookieName(config.url) },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot write cookies. Route handlers and Server Actions own refresh writes.
        }
      },
    },
  });
}
