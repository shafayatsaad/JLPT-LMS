import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isSameOriginRequest, resolveStepUpAccess, TRUSTED_DEVICE_COOKIE } from "@/lib/auth-step-up";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ status: "unavailable" }, { status: 403 });
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ status: "unavailable" }, { status: 503 });

  const cookieStore = await cookies();
  const result = await resolveStepUpAccess(supabase, cookieStore.get(TRUSTED_DEVICE_COOKIE)?.value);
  if (result === "unavailable") return NextResponse.json({ status: "unavailable" }, { status: 503 });
  if (result === "required") return NextResponse.json({ status: "required" });
  return NextResponse.json({ status: "ready" }, { headers: { "Cache-Control": "private, no-store" } });
}
