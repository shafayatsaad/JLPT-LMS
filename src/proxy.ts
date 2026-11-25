import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { getSupabasePublicConfig } from "@/lib/supabase/config";
import { getSupabaseAuthCookieName, getSupabaseServerUrl } from "@/lib/supabase/server-config";

export async function proxy(request: NextRequest) {
  const config = getSupabasePublicConfig();
  if (!config) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const supabase = createServerClient(getSupabaseServerUrl(config.url), config.publishableKey, {
    cookieOptions: { name: getSupabaseAuthCookieName(config.url) },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Proxy refreshes session cookies; each protected page still checks its user and role.
  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: ["/auth/:path*", "/dashboard/:path*", "/account/:path*", "/mistakes/:path*", "/admin/:path*"],
};
