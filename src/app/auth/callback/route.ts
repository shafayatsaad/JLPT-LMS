import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabasePublicConfig } from "@/lib/supabase/config";

function safeNext(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") && !value.includes("\\")
    ? value
    : "/dashboard";
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));

  if (url.searchParams.has("error") || url.searchParams.has("error_code")) {
    return NextResponse.redirect(new URL("/auth/login?notice=oauth-cancelled", request.url));
  }

  const config = getSupabasePublicConfig();

  if (!config || !code) {
    return NextResponse.redirect(new URL("/auth/login?notice=verification-link-invalid", request.url));
  }

  const pendingCookies: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];
  const pendingHeaders: Record<string, string> = {};
  const supabase = createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        pendingCookies.push(...cookiesToSet);
        Object.assign(pendingHeaders, headers);
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  const errorPath = next === "/auth/update-password"
    ? "/auth/login?notice=verification-failed"
    : "/auth/login?notice=oauth-session-failed";
  const response = NextResponse.redirect(
    new URL(error ? errorPath : next, request.url),
  );

  for (const { name, value, options } of pendingCookies) {
    response.cookies.set(name, value, options);
  }
  for (const [name, value] of Object.entries(pendingHeaders)) {
    response.headers.set(name, value);
  }

  return response;
}
