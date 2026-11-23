import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { resolveRequestStepUpAccess } from "@/lib/auth-step-up";

export const runtime = "nodejs";

const MAX_RECEIPT_BYTES = 4 * 1024 * 1024;
const BUCKET = "jlpt-payment-receipts";

function json(status: number, body: Record<string, unknown>) {
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}

function identifyImage(bytes: Uint8Array) {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
    && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return { mime: "image/png", extension: "png" };
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { mime: "image/jpeg", extension: "jpg" };
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return { mime: "image/webp", extension: "webp" };
  return null;
}

export async function POST(request: Request, { params }: { params: Promise<{ paymentId: string }> }) {
  const { paymentId } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(paymentId)) {
    return json(400, { error: "payment.receiptUploadFailed" });
  }
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_RECEIPT_BYTES + 65_536) {
    return json(413, { error: "payment.receiptTooLarge" });
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return json(503, { error: "payment.receiptUnavailable" });
  const storageAdmin = createSupabaseServiceClient();
  if (!storageAdmin) return json(503, { error: "payment.receiptUnavailable" });
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return json(401, { error: "payment.signInRequired" });
  const stepUp = await resolveRequestStepUpAccess(supabase);
  if (stepUp === "required") return json(428, { error: "auth.stepUpRequired" });
  if (stepUp === "unavailable") return json(503, { error: "auth.stepUpUnavailable" });

  let form: FormData;
  try { form = await request.formData(); }
  catch { return json(400, { error: "payment.receiptUploadFailed" }); }
  const file = form.get("receipt");
  if (!(file instanceof File) || file.size === 0) return json(400, { error: "payment.receiptFileInvalid" });
  if (file.size > MAX_RECEIPT_BYTES) return json(413, { error: "payment.receiptTooLarge" });

  const bytes = Buffer.from(await file.arrayBuffer());
  const image = identifyImage(bytes);
  if (!image || file.type !== image.mime) return json(400, { error: "payment.receiptTypeInvalid" });

  let sanitized: Buffer;
  try {
    const metadata = await sharp(bytes, { failOn: "warning", limitInputPixels: 16_000_000 }).metadata();
    if (!metadata.width || !metadata.height || (metadata.pages ?? 1) > 1 || metadata.width * metadata.height > 16_000_000) {
      return json(400, { error: "payment.receiptFileInvalid" });
    }
    sanitized = await sharp(bytes, { failOn: "warning", limitInputPixels: 16_000_000 })
      .rotate()
      .resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82, effort: 4 })
      .toBuffer();
  } catch {
    return json(400, { error: "payment.receiptFileInvalid" });
  }
  if (sanitized.byteLength > MAX_RECEIPT_BYTES) return json(413, { error: "payment.receiptTooLarge" });

  const storagePath = `${user.id}/${paymentId}/${randomUUID()}.webp`;
  const { error: reserveError } = await supabase.rpc("begin_payment_receipt_upload", {
    p_payment_submission_id: paymentId,
    p_storage_path: storagePath,
  });
  if (reserveError) {
    const { data: existingReceipt } = await supabase.from("payment_submissions")
      .select("receipt_storage_path,receipt_upload_started_at,receipt_uploaded_at")
      .eq("id", paymentId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (existingReceipt?.receipt_uploaded_at) return json(200, { attached: true, alreadyAttached: true });
    const reservationStarted = existingReceipt?.receipt_upload_started_at ? Date.parse(existingReceipt.receipt_upload_started_at) : NaN;
    const reservationIsStale = existingReceipt?.receipt_storage_path
      && Number.isFinite(reservationStarted)
      && Date.now() - reservationStarted > 30 * 60 * 1000;
    if (!reservationIsStale || !existingReceipt.receipt_storage_path) {
      return json(409, { error: "payment.receiptUploadFailed" });
    }
    await storageAdmin.storage.from(BUCKET).remove([existingReceipt.receipt_storage_path]);
    const { error: clearError } = await supabase.rpc("clear_payment_receipt_upload", {
      p_payment_submission_id: paymentId,
      p_storage_path: existingReceipt.receipt_storage_path,
    });
    if (clearError) return json(409, { error: "payment.receiptUploadFailed" });
    const { error: retryReserveError } = await supabase.rpc("begin_payment_receipt_upload", {
      p_payment_submission_id: paymentId,
      p_storage_path: storagePath,
    });
    if (retryReserveError) return json(409, { error: "payment.receiptUploadFailed" });
  }

  const { error: uploadError } = await storageAdmin.storage.from(BUCKET).upload(storagePath, sanitized, {
    cacheControl: "3600",
    contentType: "image/webp",
    upsert: false,
  });
  if (uploadError) {
    await storageAdmin.storage.from(BUCKET).remove([storagePath]);
    await supabase.rpc("clear_payment_receipt_upload", { p_payment_submission_id: paymentId, p_storage_path: storagePath });
    return json(503, { error: "payment.receiptUploadFailed" });
  }

  const { error: completeError } = await supabase.rpc("complete_payment_receipt_upload", {
    p_payment_submission_id: paymentId,
    p_storage_path: storagePath,
  });
  if (completeError) {
    await storageAdmin.storage.from(BUCKET).remove([storagePath]);
    await supabase.rpc("clear_payment_receipt_upload", { p_payment_submission_id: paymentId, p_storage_path: storagePath });
    return json(409, { error: "payment.receiptUploadFailed" });
  }

  return json(200, { attached: true });
}
