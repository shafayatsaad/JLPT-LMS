import { timingSafeEqual } from "node:crypto";
import { processEntitlementNotifications } from "@/lib/entitlement-notifications-worker";

export const runtime = "nodejs";

function authorized(request: Request) {
  const expected = process.env.CRON_SECRET?.trim();
  const header = request.headers.get("authorization") ?? "";
  const supplied = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!expected || !supplied) return false;
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes);
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const result = await processEntitlementNotifications();
  const status = result.state === "service_unavailable" || result.state === "configuration_invalid" ? 503 : 200;
  return Response.json(result, { status, headers: { "Cache-Control": "no-store" } });
}
