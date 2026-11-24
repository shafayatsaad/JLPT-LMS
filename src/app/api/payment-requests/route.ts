import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveRequestStepUpAccess } from "@/lib/auth-step-up";
import { paymentRequestSchema } from "@/features/payments/payment-schema";

export const runtime = "nodejs";

function json(status: number, body: Record<string, unknown>) {
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}

function safeErrorKey(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("sign in")) return "payment.signInRequired";
  if (normalized.includes("checkout is not available")) return "payment.checkoutClosed";
  if (normalized.includes("existing payment request")) return "payment.pendingExists";
  if (normalized.includes("transaction id has already been submitted") || normalized.includes("already verified")) return "payment.duplicateTransaction";
  if (normalized.includes("plan is not available")) return "payment.planUnavailable";
  if (normalized.includes("confirm that the payment details")) return "payment.confirmAccuracy";
  if (normalized.includes("reference")) return "payment.referenceRequired";
  if (normalized.includes("sender")) return "payment.senderInvalid";
  if (normalized.includes("transaction id")) return "payment.transactionInvalid";
  return "payment.submitError";
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return json(503, { error: "payment.unavailable" });

  let body: unknown;
  try {
    const bodyText = await request.text();
    if (new TextEncoder().encode(bodyText).byteLength > 16_384) return json(413, { error: "payment.validationError" });
    body = JSON.parse(bodyText);
  } catch {
    return json(400, { error: "payment.validationError" });
  }

  const parsed = paymentRequestSchema.safeParse(body);
  if (!parsed.success) return json(400, { error: "payment.validationError" });

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return json(401, { error: "payment.signInRequired" });
  const stepUp = await resolveRequestStepUpAccess(supabase);
  if (stepUp === "required") return json(428, { error: "auth.stepUpRequired" });
  if (stepUp === "unavailable") return json(503, { error: "auth.stepUpUnavailable" });

  const input = parsed.data;
  const { data, error } = await supabase.rpc("create_payment_request", {
    p_plan_id: input.planId,
    p_sender_name: input.senderName,
    p_sender_number: input.senderNumber,
    p_transaction_id: input.transactionId,
    p_reference_number: input.referenceNumber || null,
    p_payment_at: input.paymentAt,
    p_request_note: input.note || null,
    p_terms_confirmed: input.termsConfirmed,
    p_idempotency_key: input.idempotencyKey,
  });

  if (error || typeof data !== "string") {
    return json(400, { error: safeErrorKey(error?.message ?? "Payment request could not be created") });
  }

  const { data: confirmation, error: loadError } = await supabase.rpc("get_own_payment_request_confirmation", {
    p_payment_submission_id: data,
  });
  if (loadError || !confirmation || typeof confirmation !== "object" || Array.isArray(confirmation)) {
    return json(503, { error: "payment.submitError" });
  }
  const saved = confirmation as Record<string, unknown>;

  const snapshot = saved.plan_snapshot && typeof saved.plan_snapshot === "object" && !Array.isArray(saved.plan_snapshot)
    ? saved.plan_snapshot as Record<string, unknown>
    : {};
  const transactionId = typeof saved.transaction_reference === "string" ? saved.transaction_reference : "";
  const masked = transactionId.length > 7 ? `${transactionId.slice(0, 3)}••••${transactionId.slice(-4)}` : "••••";
  return json(200, {
    id: saved.id,
    amount: saved.amount,
    currency: saved.currency,
    planName: typeof snapshot.name === "string" ? snapshot.name : "",
    planNameBn: typeof snapshot.name_bn === "string" ? snapshot.name_bn : "",
    durationDays: typeof snapshot.duration_days === "number" ? snapshot.duration_days : Number(snapshot.duration_days) || 0,
    transactionMasked: masked,
  });
}
