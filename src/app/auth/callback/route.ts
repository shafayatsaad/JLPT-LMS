import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function safeNext(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") && !value.includes("\\")
    ? value
    : "/dashboard";
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));
  const supabase = await createSupabaseServerClient();

  if (url.searchParams.has("error") || url.searchParams.has("error_code")) {
    return NextResponse.redirect(new URL("/auth/login?notice=oauth-cancelled", request.url));
  }

  if (!supabase || !code) {
    return NextResponse.redirect(new URL("/auth/login?notice=verification-link-invalid", request.url));
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL("/auth/login?notice=verification-failed", request.url));
  }

  return NextResponse.redirect(new URL(next, request.url));
}
