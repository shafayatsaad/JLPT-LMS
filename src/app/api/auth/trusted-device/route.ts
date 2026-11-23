import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { hashTrustedDeviceToken, isSameOriginRequest, TRUSTED_DEVICE_COOKIE } from "@/lib/auth-step-up";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60;

function cookieOptions() {
  return { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: COOKIE_MAX_AGE };
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ ok: false }, { status: 403 });
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ ok: false }, { status: 503 });
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (userError || !user) return NextResponse.json({ ok: false }, { status: 401 });
  if (assuranceError || assurance?.currentLevel !== "aal2") return NextResponse.json({ ok: false }, { status: 403 });

  const token = randomBytes(32).toString("base64url");
  const { data, error } = await supabase.rpc("register_trusted_device", { p_token_hash: hashTrustedDeviceToken(token) });
  if (error || data !== true) return NextResponse.json({ ok: false }, { status: 503 });
  const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
  response.cookies.set(TRUSTED_DEVICE_COOKIE, token, cookieOptions());
  return response;
}

export async function DELETE(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ ok: false }, { status: 403 });
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ ok: false }, { status: 503 });
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (userError || !user) return NextResponse.json({ ok: false }, { status: 401 });
  if (assuranceError || assurance?.currentLevel !== "aal2") return NextResponse.json({ ok: false }, { status: 403 });

  const { error } = await supabase.rpc("revoke_trusted_devices");
  if (error) return NextResponse.json({ ok: false }, { status: 503 });
  const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
  response.cookies.set(TRUSTED_DEVICE_COOKIE, "", { ...cookieOptions(), maxAge: 0 });
  return response;
}
