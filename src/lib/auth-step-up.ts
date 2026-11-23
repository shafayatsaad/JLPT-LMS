import "server-only";
import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const TRUSTED_DEVICE_COOKIE = "jlpt_trusted_device";

type ServerClient = NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;
export type StepUpAccess = "ready" | "required" | "unavailable";

export function hashTrustedDeviceToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function claimsRecord(claims: unknown): Record<string, unknown> | null {
  return claims && typeof claims === "object" ? claims as Record<string, unknown> : null;
}

export async function resolveStepUpAccess(supabase: ServerClient, deviceToken?: string): Promise<StepUpAccess> {
  const { data, error } = await supabase.auth.getClaims();
  const claims = claimsRecord(data?.claims);
  if (error || !claims) return "unavailable";

  const stepUpRequired = claims.jlpt_step_up_required;
  const role = claims.role;
  if (stepUpRequired === false && role === "authenticated") return "ready";
  if (stepUpRequired === true || role === "anon") {
    if (!deviceToken) return "required";
    if (!/^[A-Za-z0-9_-]{43}$/.test(deviceToken)) return "required";

    const { data: authorized, error: authorizeError } = await supabase.rpc("authorize_trusted_device_session", {
      p_token_hash: hashTrustedDeviceToken(deviceToken),
    });
    if (authorizeError) return "unavailable";
    if (authorized !== true) return "required";

    const { error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError) return "unavailable";
    const { data: refreshedData, error: refreshedError } = await supabase.auth.getClaims();
    const refreshedClaims = claimsRecord(refreshedData?.claims);
    if (refreshedError || !refreshedClaims) return "unavailable";
    if (refreshedClaims.jlpt_step_up_required === false && refreshedClaims.role === "authenticated") return "ready";
    return refreshedClaims.jlpt_step_up_required === true || refreshedClaims.role === "anon" ? "required" : "unavailable";
  }

  if (process.env.SUPABASE_TOTP_STEP_UP_ENABLED === "true") return "unavailable";
  return "ready";
}

export function isSameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const originUrl = new URL(origin);
    const requestUrl = new URL(request.url);
    return originUrl.origin === requestUrl.origin;
  } catch {
    return false;
  }
}

export async function resolveRequestStepUpAccess(supabase: ServerClient): Promise<StepUpAccess> {
  const cookieStore = await cookies();
  return resolveStepUpAccess(supabase, cookieStore.get(TRUSTED_DEVICE_COOKIE)?.value);
}
